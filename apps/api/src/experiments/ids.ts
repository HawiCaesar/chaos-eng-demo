export const generateExperimentId = (): string => {
  const suffix = Math.floor(Math.random() * 9000) + 1000;
  return `EXP-${suffix}`;
};
