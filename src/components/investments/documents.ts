export const defaultInvestmentDocumentOptions = [
  "Contract Note",
  "Statement",
  "Tax Document",
  "Other",
] as const;

export type InvestmentDocumentOption = (typeof defaultInvestmentDocumentOptions)[number];

export type InvestmentDocumentMetadata = {
  type: string;
  fileName: string | null;
  uploadDate: string | null;
};

export function parseInvestmentDocuments(value: string | null | undefined): InvestmentDocumentMetadata[] {
  if (!value) {
    return [];
  }

  try {
    const decoded = JSON.parse(value) as unknown;
    if (!Array.isArray(decoded)) {
      return [];
    }

    return decoded
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const entry = item as Record<string, unknown>;
        return {
          type: String(entry.type ?? "Other"),
          fileName: entry.fileName ? String(entry.fileName) : null,
          uploadDate: entry.uploadDate ? String(entry.uploadDate) : null,
        };
      })
      .filter((item): item is InvestmentDocumentMetadata => Boolean(item));
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({
        type: "Other",
        fileName: item,
        uploadDate: null,
      }));
  }
}

export function serializeInvestmentDocuments(params: {
  selectedTypes: string[];
  uploadedByType: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
}): string | null {
  const selectedTypes = Array.from(new Set(params.selectedTypes));
  if (selectedTypes.length === 0) {
    return null;
  }

  const serialized = selectedTypes.map((type) => {
    const uploaded = params.uploadedByType[type];
    return {
      type,
      fileName: uploaded?.fileName ?? null,
      uploadDate: uploaded?.uploadDate ?? new Date().toISOString().slice(0, 10),
    };
  });

  return JSON.stringify(serialized);
}
