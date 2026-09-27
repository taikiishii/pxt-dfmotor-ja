/**
 * DFRobot Motor Driver (DFR0548) MakeCode Extension
 * PCA9685 PWM output control
 */
//% color="#6b3ba7" weight=100 icon="\f1b9" block="DF-Motor"
namespace dfmotor {
    const PCA9685_ADDRESS = 0x40;
    const MODE1 = 0x00;
    const PRESCALE = 0xFE;
    const LED0_ON_L = 0x06;

    // --- Enums ---

    export enum Motors {
        //% block="M1"
        M1 = 1,
        //% block="M2"
        M2 = 2,
        //% block="M3"
        M3 = 3,
        //% block="M4"
        M4 = 4
    }

    export enum Dir {
        //% block="CW"
        CW = 1,
        //% block="CCW"
        CCW = 2
    }

    export enum Servos {
        //% block="S1"
        S1 = 1,
        //% block="S2"
        S2 = 2,
        //% block="S3"
        S3 = 3,
        //% block="S4"
        S4 = 4,
        //% block="S5"
        S5 = 5,
        //% block="S6"
        S6 = 6,
        //% block="S7"
        S7 = 7,
        //% block="S8"
        S8 = 8
    }

    export enum Steppers {
        //% block="STEP1"
        M1 = 1,
        //% block="STEP2"
        M2 = 2
    }

    export enum StepperDir {
        //% block="CW"
        CW = 1,
        //% block="CCW"
        CCW = 2
    }

    class StepperConfig {
        stepsPerRev: number;
        inverted: boolean;
        maxSpeed: number;

        constructor() {
            this.stepsPerRev = 2048;
            this.inverted = false;
            this.maxSpeed = 400;
        }
    }

    let stepperConfigs: StepperConfig[] = [new StepperConfig(), new StepperConfig()];
    let initialized = false;

    // --- PCA9685 Low Level Functions ---

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(addr, buf);
    }

    function i2cread(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
    }

    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDRESS, MODE1, 0x00);
        setFreq(50);
        initialized = true;
    }

    function setFreq(freq: number): void {
        let prescaleval = 25000000;
        prescaleval /= 4096;
        prescaleval /= freq;
        prescaleval -= 1;
        let prescale = Math.floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9685_ADDRESS, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10;
        i2cwrite(PCA9685_ADDRESS, MODE1, newmode);
        i2cwrite(PCA9685_ADDRESS, PRESCALE, prescale);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode);
        basic.pause(5);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode | 0xa1);
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15) return;
        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xFF;
        buf[2] = (on >> 8) & 0xFF;
        buf[3] = off & 0xFF;
        buf[4] = (off >> 8) & 0xFF;
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf);
    }

    // ==========================================
    // 1. DC Motor Control
    // ==========================================

    /**
     * Run DC motor.
     * @param index Motor index (M1~M4)
     * @param direction Rotation direction (CW/CCW)
     * @param speed Speed (0~255), eg: 150
     */
    //% block="motor %index|run %direction|speed %speed"
    //% speed.min=0 speed.max=255 speed.defl=150
    //% inlineInputMode=inline
    //% weight=100
    export function motorRun(index: Motors, direction: Dir, speed: number): void {
        if (!initialized) {
            initPCA9685();
        }
        speed = Math.max(0, Math.min(255, speed));
        let pwm = Math.floor(speed * 16);

        let pnp = (index - 1) * 2;
        if (direction === Dir.CW) {
            setPwm(pnp, 0, pwm);
            setPwm(pnp + 1, 0, 0);
        } else {
            setPwm(pnp, 0, 0);
            setPwm(pnp + 1, 0, pwm);
        }
    }

    /**
     * Stop specific DC motor.
     * @param index Motor index (M1~M4)
     */
    //% block="motor %index|stop"
    //% weight=95
    export function motorStop(index: Motors): void {
        if (!initialized) {
            initPCA9685();
        }
        let pnp = (index - 1) * 2;
        setPwm(pnp, 0, 0);
        setPwm(pnp + 1, 0, 0);
    }

    // ==========================================
    // 2. Servo Motor Control
    // ==========================================

    /**
     * Set servo motor angle.
     * @param index Servo index (S1~S8)
     * @param degree Angle in degrees (0~180), eg: 90
     */
    //% block="servo %index|set angle to %degree|°"
    //% degree.min=0 degree.max=180 degree.defl=90
    //% inlineInputMode=inline
    //% weight=80
    export function servoRun(index: Servos, degree: number): void {
        if (!initialized) {
            initPCA9685();
        }
        degree = Math.max(0, Math.min(180, degree));
        // 0.6ms ~ 2.4ms at 50Hz (same as DFRobot pxt-motor)
        let us = 600 + (degree * 1800) / 180;
        let pulse = Math.floor(us * 4096 / 20000);
        // S1 = channel 15 ... S8 = channel 8
        let channel = 16 - index;
        setPwm(channel, 0, pulse);
    }

    // ==========================================
    // 3. Stepper Motor Control
    // ==========================================

    /**
     * Configure stepper motor parameters.
     * @param index Stepper index (STEP1 / STEP2)
     * @param stepsPerRev Steps per revolution, eg: 2048
     * @param inverted Invert rotation direction
     * @param maxSpeed Max speed in steps/sec, eg: 400
     */
    //% block="stepper %index| config | steps/rev: %stepsPerRev| invert dir: %inverted| max speed(steps/s): %maxSpeed"
    //% inlineInputMode=external
    //% stepsPerRev.defl=2048 stepsPerRev.min=1
    //% maxSpeed.defl=400 maxSpeed.min=1
    //% weight=70
    //% blockGap=12
    export function configStepper(index: Steppers, stepsPerRev: number, inverted: boolean, maxSpeed: number): void {
        let cfg = stepperConfigs[index - 1];
        cfg.stepsPerRev = Math.max(1, stepsPerRev);
        cfg.inverted = inverted;
        cfg.maxSpeed = Math.max(1, maxSpeed);
    }

    /**
     * Move stepper motor.
     * @param index Stepper index (STEP1 / STEP2)
     * @param dir Rotation direction
     * @param degree Angle in degrees (0 for continuous), eg: 360
     * @param speed Speed in steps/sec (0 for max), eg: 200
     */
    //% block="stepper %index| move %dir| || degree %degree| speed(steps/s) %speed"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode=inline
    //% degree.defl=0 degree.min=0
    //% speed.defl=0 speed.min=0
    //% weight=65
    export function moveStepper(index: Steppers, dir: StepperDir, degree: number, speed: number): void {
        if (!initialized) {
            initPCA9685();
        }

        let cfg = stepperConfigs[index - 1];

        let effectiveDir = dir;
        if (cfg.inverted) {
            effectiveDir = (dir === StepperDir.CW) ? StepperDir.CCW : StepperDir.CW;
        }

        let targetSpeed = (speed <= 0) ? cfg.maxSpeed : Math.min(speed, cfg.maxSpeed);

        setFreq(targetSpeed);

        let offset = (index - 1) * 4;
        if (effectiveDir === StepperDir.CW) {
            setPwm(offset + 0, 0, 1024);
            setPwm(offset + 1, 1024, 2048);
            setPwm(offset + 2, 2048, 3072);
            setPwm(offset + 3, 3072, 4095);
        } else {
            setPwm(offset + 0, 3072, 4095);
            setPwm(offset + 1, 2048, 3072);
            setPwm(offset + 2, 1024, 2048);
            setPwm(offset + 3, 0, 1024);
        }

        if (degree > 0) {
            let targetSteps = (degree / 360) * cfg.stepsPerRev;
            let durationMs = (targetSteps / targetSpeed) * 1000;

            basic.pause(durationMs);
            stopStepper(index);
        }
    }

    /**
     * Stop stepper motor.
     * @param index Stepper index (STEP1 / STEP2)
     */
    //% block="stepper %index| stop"
    //% weight=60
    export function stopStepper(index: Steppers): void {
        if (!initialized) return;
        let offset = (index - 1) * 4;
        for (let i = 0; i < 4; i++) {
            setPwm(offset + i, 0, 0);
        }
    }
}