export const birthdayCountdownConfig = {
  // targetAt 设为 null 时才启用 15 秒演示。
  demoSeconds: 15,
  // 按设备系统时间倒数到北京时间 2027 年 1 月 10 日零点。
  targetAt: "2027-01-10T00:00:00+08:00",
  // targetAt: null,
  timeZone: "Asia/Shanghai",
};

export function resolveCountdownDeadline(config, now = Date.now()) {
  if (config.targetAt !== null && config.targetAt !== undefined) {
    if (typeof config.targetAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(config.targetAt)) {
      throw new Error("生日目标时间请使用带秒和时区的格式，例如 2027-01-10T00:00:00+08:00。");
    }
    const deadline = Date.parse(config.targetAt);
    if (!Number.isFinite(deadline)) throw new Error("生日倒计时的目标日期无效。");
    return deadline;
  }
  if (!Number.isFinite(config.demoSeconds) || config.demoSeconds < 0) {
    throw new Error("演示倒计时秒数必须是非负数字。");
  }
  return now + config.demoSeconds * 1000;
}

export function countdownSnapshot(deadline, now = Date.now()) {
  const remainingMs = Math.max(0, deadline - now);
  const seconds = Math.ceil(remainingMs / 1000);
  return {
    remainingMs,
    seconds,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    secondPart: seconds % 60,
    finalSeconds: seconds <= 10,
    complete: remainingMs === 0,
  };
}

export function canAccessBirthday(deadline, now = Date.now()) {
  return Number.isFinite(deadline) && Number.isFinite(now) && now >= deadline;
}
