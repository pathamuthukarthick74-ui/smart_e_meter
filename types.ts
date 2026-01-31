
export interface EnergyReading {
  timestamp: string;
  power: number; // Watts
  voltage: number; // Volts
  powerLoss: number; // Watts (simulated loss)
}

export interface Appliance {
  id: string;
  name: string;
  type: 'lightbulb' | 'fan' | 'heater' | 'other';
  isOn: boolean;
  basePower: number; // Nominal power in Watts
  currentPower: number;
  currentVoltage: number;
  currentPowerLoss: number;
  history: EnergyReading[];
  aiPrediction?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}
