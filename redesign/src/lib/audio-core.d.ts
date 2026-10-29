export class ArcadeAudio {
  constructor(enabled?: boolean);
  enabled: boolean;
  playbackSession: boolean;
  setEnabled(enabled: boolean): void;
  prepare(): Promise<boolean>;
  tone(
    frequency: number,
    duration?: number,
    type?: OscillatorType,
    volume?: number,
    delay?: number,
  ): void;
  tap(): void;
  pop(): void;
  chime(): void;
  buzz(): void;
  hiss(): void;
  rattle(count?: number, base?: number): void;
  impact(intensity?: number): void;
  goal(): void;
  tick(): void;
  tickLow(): void;
  buzzer(): void;
}
