function getTimeZone() {
  return process.env.LEARNING_PATH_TIMEZONE || "Asia/Ho_Chi_Minh";
}

function padTwo(value) {
  return String(value).padStart(2, "0");
}

function getZonedDateParts(date = new Date(), timeZone = getTimeZone()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getLocalDateKey(date = new Date()) {
  const zoned = getZonedDateParts(date);
  return [zoned.year, padTwo(zoned.month), padTwo(zoned.day)].join("-");
}

function getLocalWeekKey(date = new Date()) {
  try {
    const zoned = getZonedDateParts(date);
    const target = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day));
    const dayNum = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNum + 3);

    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);

    const weekNumber = 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
    const resolvedWeekKey = `${target.getUTCFullYear()}-${padTwo(weekNumber)}`;
    console.log("[LP_WEEK_KEY] resolvedWeekKey", resolvedWeekKey);
    return resolvedWeekKey;
  } catch (error) {
    const fallbackWeekKey = `fallback-${Math.floor(new Date(date).getTime() / (7 * 24 * 60 * 60 * 1000))}`;
    console.log("[LP_WEEK_KEY] resolvedWeekKey", fallbackWeekKey);
    return fallbackWeekKey;
  }
}

module.exports = {
  getTimeZone,
  getZonedDateParts,
  getLocalDateKey,
  getLocalWeekKey,
};
