export interface SolarPosition {
  azimuth: number; // 0° = North, 90° = East, 180° = South, 270° = West
  elevation: number; // Height above horizon (-90° to +90°)
  isUp: boolean; // Whether sun is above horizon
}

export class SolarCalculator {
  /**
   * Get approximate solar position for time of day presets
   */
  static getSolarPositionForTimeOfDay(
    timeOfDay: "dawn" | "day" | "dusk" | "night",
    latitude: number,
    longitude: number,
    date: Date = new Date(),
  ): SolarPosition {
    // Map time of day to approximate hours
    const timeMapping = {
      dawn: 6, // 6 AM
      day: 12, // 12 PM (noon)
      dusk: 18, // 6 PM
      night: 0, // 12 AM (midnight)
    };

    const hour = timeMapping[timeOfDay];
    const calculationDate = new Date(date);
    calculationDate.setHours(hour, 0, 0, 0);

    return this.getSolarPosition(calculationDate, latitude, longitude);
  }

  /**
   * Calculate precise solar position using simplified astronomical formulas
   */
  static getSolarPosition(date: Date, latitude: number, longitude: number): SolarPosition {
    const dayOfYear = this.getDayOfYear(date);
    const hour = date.getHours() + date.getMinutes() / 60;

    // Solar declination (simplified)
    const declination = (23.45 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365) * Math.PI) / 180;

    // Equation of time (simplified approximation)
    const equationOfTime = 4 * (longitude - 15 * Math.floor((longitude + 7.5) / 15));

    // Hour angle (adjusted for longitude)
    const solarTime = hour + equationOfTime / 60;
    const hourAngle = (15 * (solarTime - 12) * Math.PI) / 180; // 15°/hour

    // Convert latitude to radians
    const latRad = (latitude * Math.PI) / 180;

    // Calculate elevation
    const elevation =
      (Math.asin(
        Math.sin(declination) * Math.sin(latRad) +
          Math.cos(declination) * Math.cos(latRad) * Math.cos(hourAngle),
      ) *
        180) /
      Math.PI;

    // Calculate azimuth
    const azimuthRad = Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(declination) * Math.cos(latRad),
    );

    // Convert to compass bearing (0° = North)
    const azimuth = ((azimuthRad * 180) / Math.PI + 180) % 360;

    return {
      azimuth,
      elevation,
      isUp: elevation > 0,
    };
  }

  private static getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
