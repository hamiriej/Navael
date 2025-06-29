
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CurrencyCode } from "@/contexts/appearance-settings-context";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currencyCode: CurrencyCode): string {
  if (currencyCode === 'USD') {
    return `$${value.toFixed(2)}`;
  } else if (currencyCode === 'UGX') {
    // UGX typically doesn't use decimals and uses comma separators for thousands
    return `UGX ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  // Fallback for unhandled currencies or default
  return `${currencyCode} ${value.toFixed(2)}`;
}

export function convertToCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  const columnOrder = headers || Object.keys(data[0]);

  const headerRow = columnOrder
    .map(header => `"${header.replace(/"/g, '""')}"`) // Sanitize headers
    .join(',');

  const dataRows = data.map(row =>
    columnOrder
      .map(fieldName => {
        let fieldValue = row[fieldName] === null || row[fieldName] === undefined ? '' : String(row[fieldName]);
        // Escape commas, quotes, and newlines
        if (typeof fieldValue === 'string' && (fieldValue.includes(',') || fieldValue.includes('"') || fieldValue.includes('\n'))) {
          fieldValue = `"${fieldValue.replace(/"/g, '""')}"`;
        }
        return fieldValue;
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

export function triggerDownload(content: string, filename: string, contentType: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function triggerCsvDownload(csvString: string, filename: string) {
  triggerDownload(csvString, filename, 'text/csv;charset=utf-8;');
}

export function triggerTxtDownload(textString: string, filename: string) {
  triggerDownload(textString, filename, 'text/plain;charset=utf-8;');
}

