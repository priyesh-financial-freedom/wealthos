import {
  createRealEstateProperty,
  getRealEstateProperties,
  updateRealEstateProperty,
} from "@/services/realEstateProperties";
import type {
  ImportIssue,
  ImportModulePlugin,
  ImportValidationResult,
  ImportValidatedRecord,
} from "@/services/imports/types";
import {
  buildNormalizedRow,
  isUuid,
  issue,
  parseDate,
  parseNumber,
  parseString,
  pickValue,
} from "@/services/imports/utils";
import type {
  OccupancyStatus,
  RealEstatePropertyInsert,
  RealEstatePropertyType,
} from "@/types/realEstateProperty";

const propertyTypes: RealEstatePropertyType[] = ["Apartment", "Villa", "Independent House", "Plot", "Commercial", "Other"];
const occupancyTypes: OccupancyStatus[] = ["self_occupied", "rented"];

interface RealEstateImportPayload {
  id?: string;
  values: RealEstatePropertyInsert;
}

function parsePropertyType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  return propertyTypes.find((item) => item.toLowerCase() === normalized) ?? null;
}

function parseOccupancy(value: string | null) {
  if (!value) {
    return "self_occupied" as const;
  }

  const normalized = value.toLowerCase().replaceAll(" ", "_");
  if (normalized === "selfoccupied") {
    return "self_occupied" as const;
  }

  return occupancyTypes.find((item) => item === normalized) ?? null;
}

export const realEstateImportPlugin: ImportModulePlugin<RealEstateImportPayload> = {
  moduleId: "real-estate",
  displayName: "Real Estate",
  supportedSheets: ["Real Estate"],
  async validateRows(sheetName, rows) {
    const issues: ImportIssue[] = [];
    const records: Array<ImportValidatedRecord<RealEstateImportPayload>> = [];
    const existing = await getRealEstateProperties();
    const existingIds = new Set(existing.map((item) => item.id));

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = buildNormalizedRow(rawRow);

      const id = parseString(pickValue(row, ["id"]));
      const propertyName = parseString(pickValue(row, ["property_name", "property name"]));
      const propertyType = parsePropertyType(parseString(pickValue(row, ["property_type", "property type", "type"])));
      const owner = parseString(pickValue(row, ["owner"]));
      const purchaseDateRaw = pickValue(row, ["purchase_date", "purchase date"]);
      const purchaseDate = purchaseDateRaw === undefined ? null : parseDate(purchaseDateRaw);
      const purchasePrice = parseNumber(pickValue(row, ["purchase_price", "purchase price"]));
      const currentMarketValue = parseNumber(pickValue(row, ["current_market_value", "current market value", "current value"]));
      const city = parseString(pickValue(row, ["city"]));
      const state = parseString(pickValue(row, ["state"]));
      const occupancyStatus = parseOccupancy(parseString(pickValue(row, ["occupancy_status", "self occupied / rented", "occupancy"])));
      const monthlyRent = parseNumber(pickValue(row, ["monthly_rent", "monthly rent"]));
      const linkedLoanId = parseString(pickValue(row, ["linked_home_loan_id", "linked home loan id"]));

      if (id && !isUuid(id)) {
        issues.push(issue({ sheetName, rowNumber, field: "id", message: "ID must be a valid UUID." }));
      }

      if (!propertyName) {
        issues.push(issue({ sheetName, rowNumber, field: "property_name", message: "Property name is required." }));
      }

      if (!propertyType) {
        issues.push(issue({ sheetName, rowNumber, field: "property_type", message: "Invalid property type." }));
      }

      if (!owner) {
        issues.push(issue({ sheetName, rowNumber, field: "owner", message: "Owner is required." }));
      }

      if (purchaseDateRaw !== undefined && !purchaseDate) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_date", message: "Purchase date is invalid." }));
      }

      if (purchasePrice === null) {
        issues.push(issue({ sheetName, rowNumber, field: "purchase_price", message: "Purchase price must be a valid number." }));
      }

      if (currentMarketValue === null) {
        issues.push(issue({ sheetName, rowNumber, field: "current_market_value", message: "Current market value must be a valid number." }));
      }

      if (!city) {
        issues.push(issue({ sheetName, rowNumber, field: "city", message: "City is required." }));
      }

      if (!state) {
        issues.push(issue({ sheetName, rowNumber, field: "state", message: "State is required." }));
      }

      if (!occupancyStatus) {
        issues.push(issue({ sheetName, rowNumber, field: "occupancy_status", message: "Occupancy status must be self_occupied or rented." }));
      }

      if (linkedLoanId && !isUuid(linkedLoanId)) {
        issues.push(issue({ sheetName, rowNumber, field: "linked_home_loan_id", message: "Linked home loan ID must be a valid UUID." }));
      }

      if (occupancyStatus === "rented" && (monthlyRent === null || monthlyRent < 0)) {
        issues.push(issue({ sheetName, rowNumber, field: "monthly_rent", message: "Monthly rent must be a non-negative number for rented properties." }));
      }

      const hasErrors = issues.some((item) => item.sheetName === sheetName && item.rowNumber === rowNumber && item.severity === "error");
      if (
        hasErrors ||
        !propertyName ||
        !propertyType ||
        !owner ||
        purchasePrice === null ||
        currentMarketValue === null ||
        !city ||
        !state ||
        !occupancyStatus
      ) {
        return;
      }

      if (id && !existingIds.has(id)) {
        issues.push(
          issue({
            sheetName,
            rowNumber,
            field: "id",
            message: "ID does not exist for this user. Record will be created instead.",
            severity: "warning",
          }),
        );
      }

      const values: RealEstatePropertyInsert = {
        property_name: propertyName,
        property_type: propertyType,
        owner,
        purchase_date: purchaseDate,
        purchase_price: purchasePrice,
        current_market_value: currentMarketValue,
        address: parseString(pickValue(row, ["address"])),
        city,
        state,
        pin_code: parseString(pickValue(row, ["pin_code", "pin code"])),
        occupancy_status: occupancyStatus,
        monthly_rent: occupancyStatus === "rented" ? Number(monthlyRent ?? 0) : 0,
        linked_home_loan_id: linkedLoanId,
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
    } as ImportValidationResult<RealEstateImportPayload>;
  },
  async executeRows(sheetName, records) {
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.action === "update" && record.payload.id) {
          await updateRealEstateProperty({ id: record.payload.id, ...record.payload.values });
          updated += 1;
        } else {
          await createRealEstateProperty(record.payload.values);
          inserted += 1;
        }
      } catch (error) {
        failed += 1;
        issues.push(
          issue({
            severity: "error",
            sheetName,
            rowNumber: record.rowNumber,
            message: error instanceof Error ? error.message : "Unable to import real estate row.",
          }),
        );
      }
    }

    return { inserted, updated, failed, issues };
  },
};
