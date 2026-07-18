import { createSilverHolding, getSilverHoldings, updateSilverHolding } from "@/services/silverHoldings";
import type { ImportIssue, ImportModulePlugin, ImportValidationResult, ImportValidatedRecord } from "@/services/imports/types";
import { buildNormalizedRow, isUuid, issue, parseDate, parseNumber, parseString, pickValue } from "@/services/imports/utils";
import type { SilverHoldingInsert, SilverHoldingType } from "@/types/silverHolding";

const holdingTypes: SilverHoldingType[] = ["Physical Silver", "Silver ETF", "Digital Silver"];

interface SilverImportPayload {
  id?: string;
  values: SilverHoldingInsert;
}

function parseHoldingType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return holdingTypes.find((item) => item.toLowerCase() === normalized) ?? null;
}

export const silverImportPlugin: ImportModulePlugin<SilverImportPayload> = {
  moduleId: "silver",
  displayName: "Silver",
  supportedSheets: ["Silver"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<SilverImportPayload>> = [];
    const existing = await getSilverHoldings();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const holdingType = parseHoldingType(parseString(pickValue(row, ["holding_type", "holding type", "type"])));
      const description = parseString(pickValue(row, ["description"]));
      const quantity = parseNumber(pickValue(row, ["quantity"]));
      const unit = parseString(pickValue(row, ["unit"])) ?? "g";
      const costBasis = parseNumber(pickValue(row, ["cost_basis", "cost basis"]));
      const currentValue = parseNumber(pickValue(row, ["current_value", "current value"]));
      const purchaseDateRaw = pickValue(row, ["purchase_date", "purchase date"]);
      const purchaseDate = purchaseDateRaw === undefined ? null : parseDate(purchaseDateRaw);

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!holdingType) {
        issues.push(issue({ sheetName, rowNumber, field: "holding_type", message: "Invalid holding type." }));
      }

      if (!description) {
        issues.push(issue({ sheetName, rowNumber, field: "description", message: "Description is required." }));
      }

      if (quantity === null) {
        issues.push(issue({ sheetName, rowNumber, field: "quantity", message: "Quantity must be a valid number." }));
      }

      if (costBasis === null) {
        issues.push(issue({ sheetName, rowNumber, field: "cost_basis", message: "Cost basis must be a valid number." }));
      }

      if (currentValue === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_value", message: "Current value must be a valid number." }));
      }

      if (purchaseDateRaw !== undefined && !purchaseDate) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_date", message: "Purchase date is invalid." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (hasErrors || !holdingType || !description || quantity === null || costBasis === null || currentValue === null) {
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

      const values: SilverHoldingInsert = {
        holding_type: holdingType,
        description,
        quantity,
        unit,
        cost_basis: costBasis,
        current_value: currentValue,
        purchase_date: purchaseDate,
        purity: parseString(pickValue(row, ["purity"])),
        custodian: parseString(pickValue(row, ["custodian"])),
        institution: parseString(pickValue(row, ["institution"])),
        owner: parseString(pickValue(row, ["owner"])),
        nominee: parseString(pickValue(row, ["nominee"])),
        notes: parseString(pickValue(row, ["notes"])),
        documents_placeholder: parseString(pickValue(row, ["documents_placeholder", "documents placeholder"])),
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
    } as ImportValidationResult<SilverImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateSilverHolding({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createSilverHolding(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import silver row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
