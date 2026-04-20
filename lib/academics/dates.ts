const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseAssignmentDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(normalized);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const parsedDate = new Date(year, monthIndex, day, 12, 0, 0, 0);

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== monthIndex ||
      parsedDate.getDate() !== day
    ) {
      return null;
    }

    return parsedDate;
  }

  const parsedDate = new Date(normalized);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function parseCanvasDueDate(value: string | null | undefined): Date | null {
  return parseAssignmentDate(value);
}

export function getAssignmentTimestamp(value: string | null | undefined): number | null {
  return parseAssignmentDate(value)?.getTime() ?? null;
}
