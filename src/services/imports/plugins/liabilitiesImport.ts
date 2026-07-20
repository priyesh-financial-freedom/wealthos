import { getLiabilities, updateLiability } from "@/services/liabilities";
import { supabase } from "@/lib/supabase/client";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { LiabilityInsert, LiabilityStatus, LiabilityType } from "@/types/liability";

const liabilityTypes: LiabilityType[] = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Education Loan",
  "Loan Against Property",
  "Credit Card",
  "Overdraft / Line of Credit",
  "Other Liability",
];
const statuses: LiabilityStatus[] = ["active", "paid_off", "pending", "closed"];

interface LiabilityImportPayload {
  id?: string;
  values: LiabilityInsert;
}

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUserId() {
  const client = assertSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required.");
  }

  return user.id;
}

function parseLiabilityType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return liabilityTypes.find((item) => item.toLowerCase() === normalized) ?? null;
}

function parseStatus(value: string | null) {
  if (!value) {
    return "active" as const;
  }

  const normalized = value.toLowerCase();
  return statuses.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const liabilitiesImportPlugin: ImportModulePlugin<LiabilityImportPayload> = {
  moduleId: "liabilities",
  displayName: "Liabilities",
  supportedSheets: ["Liabilities"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<LiabilityImportPayload>> = [];
    const existing = await getLiabilities();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const liabilityType = parseLiabilityType(parseString(pickValue(row, ["liability_type", "liability type", "type"])));
      const lender = parseString(pickValue(row, ["lender"]));
      const accountName = parseString(pickValue(row, ["account_name", "account name", "name"]));
      const outstandingAmount = parseNumber(pickValue(row, ["outstanding_amount", "outstanding amount"]));
      const status = parseStatus(parseString(pickValue(row, ["status"])));
      const dueDayValue = pickValue(row, ["due_day", "due day"]);
      const dueDay = dueDayValue === undefined ? null : parseNumber(dueDayValue);
      const startDateRaw = pickValue(row, ["start_date", "start date"]);
      const endDateRaw = pickValue(row, ["end_date", "end date"]);
      const dueDateRaw = pickValue(row, ["due_date", "due date"]);
      const startDate = startDateRaw === undefined ? null : parseDate(startDateRaw);
      const endDate = endDateRaw === undefined ? null : parseDate(endDateRaw);
      const dueDate = dueDateRaw === undefined ? null : parseDate(dueDateRaw);

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!liabilityType) {
        issues.push(issue({ sheetName, rowNumber, field: "liability_type", message: "Invalid liability type." }));
      }

      if (!lender) {
        issues.push(issue({ sheetName, rowNumber, field: "lender", message: "Lender is required." }));
      }

      if (!accountName) {
        issues.push(issue({ sheetName, rowNumber, field: "account_name", message: "Account name is required." }));
      }

      if (outstandingAmount === null) {
        issues.push(issue({ sheetName, rowNumber, field: "outstanding_amount", message: "Outstanding amount must be a valid number." }));
      }

      if (!status) {
        issues.push(issue({ sheetName, rowNumber, field: "status", message: "Invalid status." }));
      }

      if (dueDayValue !== undefined && (dueDay === null || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
        issues.push(issue({ sheetName, rowNumber, field: "due_day", message: "Due day must be an integer between 1 and 31." }));
      }

      if (startDateRaw !== undefined && !startDate) {
        issues.push(issue({ sheetName, rowNumber, field: "start_date", message: "Start date is invalid." }));
      }

      if (endDateRaw !== undefined && !endDate) {
        issues.push(issue({ sheetName, rowNumber, field: "end_date", message: "End date is invalid." }));
      }

      if (dueDateRaw !== undefined && !dueDate) {
        issues.push(issue({ sheetName, rowNumber, field: "due_date", message: "Due date is invalid." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !liabilityType || !lender || !accountName || outstandingAmount === null || !status) {
        return;
      }

      if (id && !existingIds.has(id)) {
        issues.push(issue({
          sheetName,
          rowNumber,
          field: "id",
          message: "ID does not exist for this user. Record will be created instead.",
          severity: "warning",
        }));
      }

      const values: LiabilityInsert = {
        liability_type: liabilityType,
        lender,
        account_name: accountName,
        outstanding_amount: outstandingAmount,
        original_amount: parseNumber(pickValue(row, ["original_amount", "original amount"])),
        interest_rate: parseNumber(pickValue(row, ["interest_rate", "interest rate"])),
        emi: parseNumber(pickValue(row, ["emi"])),
        start_date: startDate,
        end_date: endDate,
        due_day: dueDay,
        due_date: dueDate,
        tenure_months: parseNumber(pickValue(row, ["tenure_months", "tenure months", "tenure"])),
        credit_limit: parseNumber(pickValue(row, ["credit_limit", "credit limit"])),
        sanction_limit: parseNumber(pickValue(row, ["sanction_limit", "sanction limit"])),
        status,
        notes: parseString(pickValue(row, ["notes"])),
      };

      records.push({
        rowNumber,
        action: id && existingIds.has(id) ? "update" : "create",
        payload: {
          id: id && existingIds.has(id) ? id : undefined,
          values,
        },
      });
    });

    return {
      totalRows: rows.length,
      records,
      issues,
    } as ImportValidationResult<LiabilityImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    console.info("[imports][liabilities] executeRows:start", {
      sheetName,
      records: records.length,
    });

    const createRecords = records.filter((record) => record.action !== "update" || !record.payload.id);
    const updateRecords = records.filter((record) => record.action === "update" && record.payload.id);

    console.info("[imports][liabilities] executeRows:createRecords", {
      sheetName,
      createRecords: createRecords.length,
      updateRecords: updateRecords.length,
    });

    if (createRecords.length === 0) {
      console.warn("[imports][liabilities] executeRows:noCreateRecords", {
        sheetName,
        records: records.length,
      });
    }

    if (createRecords.length > 0) {
      try {
        const userId = await requireAuthenticatedUserId();
        const insertPayload = createRecords.map((record) => ({
          ...record.payload.values,
          user_id: userId,
        }));

        console.info("[imports][liabilities] executeRows:beforeInsert", {
          sheetName,
          rows: insertPayload.length,
          sample: insertPayload[0],
        });

        const { data, error } = await assertSupabaseClient()
          .from("liabilities")
          .insert(insertPayload)
          .select("id");

        console.info("[imports][liabilities] executeRows:afterInsert", {
          sheetName,
          requestedRows: insertPayload.length,
          insertedRows: data?.length ?? 0,
        });

        if (error) {
          console.error("[imports][liabilities] executeRows:insertError", {
            sheetName,
            error,
          });
          throw new Error(error.message);
        }

        inserted += data?.length ?? 0;

        if (!data || data.length === 0) {
          const zeroInsertError = "Supabase insert returned zero rows for liabilities import.";
          console.error("[imports][liabilities] executeRows:zeroInserted", {
            sheetName,
            rowsRequested: insertPayload.length,
          });
          failed += createRecords.length;
          createRecords.forEach((record) => {
            issues.push(
              issue({
                severity: "error",
                sheetName,
                rowNumber: record.rowNumber,
                message: zeroInsertError,
              }),
            );
          });
        }
      } catch (error) {
        console.error("[imports][liabilities] executeRows:createBatchError", {
          sheetName,
          error,
        });
        failed += createRecords.length;
        createRecords.forEach((record) => {
          issues.push(
            issue({
              severity: "error",
              sheetName,
              rowNumber: record.rowNumber,
              message: error instanceof Error ? error.message : "Unable to import liability row.",
            }),
          );
        });
      }
    }

    for (const record of updateRecords) {
      try {
        await updateLiability({ id: record.payload.id!, ...record.payload.values });
        updated += 1;
      } catch (error) {
        console.error("[imports][liabilities] executeRows:updateError", {
          sheetName,
          rowNumber: record.rowNumber,
          error,
        });
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import liability row.",
          }),
        );
      }
    }

    console.info("[imports][liabilities] executeRows:done", {
      sheetName,
      inserted,
      updated,
      failed,
      issues: issues.length,
    });

    return { inserted, updated, failed, issues };
  },
};
