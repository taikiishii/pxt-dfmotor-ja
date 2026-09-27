/**
 * DF-Motor: MakeCode extension for the DFRobot micro:bit Motor Driver (DFR0548)
 *
 * The board drives every output from one PCA9685 16-channel PWM chip (I2C 0x40).
 *   channel 0-7  : H-bridge inputs of the DC motors (M4 = 0/1, M3 = 2/3, M2 = 4/5, M1 = 6/7)
 *   channel 8-15 : servo headers (S8 = 8 ... S1 = 15)
 * All channels share one PWM frequency.
 *
 * Copyright (c) 2026 Taiki Ishii
 * Released under the MIT License. See LICENSE.txt.
 */
//% color="#6b3ba7" weight=100 icon="\f1b9" block="DF-Motor"
namespace dfmotor {

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

    export enum StepperWait {
        //% block="wait until done"
        Wait = 1,
        //% block="don't wait"
        NoWait = 2
    }

    // --- PCA9685 (values from the datasheet) ---

    const I2C_ADDR = 0x40;
    const REG_MODE1 = 0x00;
    const REG_LED0_ON_L = 0x06;     // LEDn_ON_L = 0x06 + 4 * n
    const REG_PRE_SCALE = 0xFE;
    const MODE1_RESTART = 0x80;
    const MODE1_AI = 0x20;          // register auto increment
    const MODE1_SLEEP = 0x10;       // set after power on
    const OSC_HZ = 25000000;
    const PERIOD = 4096;            // counts in one PWM cycle
    const FULL_OFF = 0x1000;        // bit 4 of LEDn_OFF_H
    const MIN_HZ = 24;              // PRE_SCALE = 255
    const MAX_HZ = 1526;            // PRE_SCALE = 3

    const SERVO_HZ = 50;
    const SERVO_MIN_US = 600;
    const SERVO_MAX_US = 2400;

    // current PWM frequency, 0 = the chip is not set up yet
    let pwmHz = 0;
    // frequency the chip really runs at (PRE_SCALE is an integer)
    let actualHz = 0;

    function writeReg(reg: number, value: number): void {
        let buf = pins.createBuffer(2);
        buf.setNumber(NumberFormat.UInt8LE, 0, reg);
        buf.setNumber(NumberFormat.UInt8LE, 1, value);
        pins.i2cWriteBuffer(I2C_ADDR, buf);
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(I2C_ADDR, reg, NumberFormat.UInt8LE, true);
        return pins.i2cReadNumber(I2C_ADDR, NumberFormat.UInt8LE);
    }

    // PRE_SCALE can be written only while the oscillator sleeps
    function setPwmHz(hz: number): void {
        let prescale = Math.round(OSC_HZ / (PERIOD * hz)) - 1;
        writeReg(REG_MODE1, MODE1_AI | MODE1_SLEEP);
        writeReg(REG_PRE_SCALE, prescale);
        writeReg(REG_MODE1, MODE1_AI);
        control.waitMicros(500);    // oscillator start up time
        writeReg(REG_MODE1, MODE1_AI | MODE1_RESTART);
        pwmHz = hz;
        actualHz = OSC_HZ / (PERIOD * (prescale + 1));
    }

    // Write on/off pairs to consecutive channels in one I2C transfer.
    // The chip applies all of them together at the I2C STOP.
    function setChannels(first: number, counts: number[]): void {
        let buf = pins.createBuffer(1 + 2 * counts.length);
        buf.setNumber(NumberFormat.UInt8LE, 0, REG_LED0_ON_L + 4 * first);
        for (let i = 0; i < counts.length; i++) {
            buf.setNumber(NumberFormat.UInt16LE, 1 + 2 * i, counts[i]);
        }
        pins.i2cWriteBuffer(I2C_ADDR, buf);
    }

    // output goes high at count `on` and low at count `off` in every cycle
    function setChannel(channel: number, on: number, off: number): void {
        setChannels(channel, [on, off]);
    }

    function channelOff(channel: number): void {
        setChannel(channel, 0, FULL_OFF);
    }

    // Set the chip up on first use. Do it again after the board power was
    // switched off and on: the micro:bit keeps running, but the chip wakes up
    // in sleep mode with all outputs off.
    function ensureReady(): void {
        if (pwmHz > 0 && (readReg(REG_MODE1) & MODE1_SLEEP) == 0) return;
        setPwmHz(SERVO_HZ);
        stepperActive[0] = false;
        stepperActive[1] = false;
        updateServoOutputs();
    }

    // --- Motor / servo / stepper state ---

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
    let stepperActive: boolean[] = [false, false];
    let stepperCw: boolean[] = [false, false];
    // incremented on every move, so an older move does not stop a newer one
    let stepperMoveId: number[] = [0, 0];
    // last servo pulse for S1..S8 in counts at 50Hz, 0 = never used
    let servoCounts: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    let warningShown = false;

    // lower channel of the H-bridge, the upper one turns the motor CW
    function motorChannel(index: number): number {
        return 8 - 2 * index;
    }

    function servoChannel(index: number): number {
        return 16 - index;
    }

    function anyStepperActive(): boolean {
        return stepperActive[0] || stepperActive[1];
    }

    // Servos need 50Hz. While a stepper runs at another frequency their pulses
    // are stopped, and they go back to the last angle when all steppers stop.
    function updateServoOutputs(): void {
        for (let i = 1; i <= 8; i++) {
            let counts = servoCounts[i - 1];
            if (counts == 0) continue;
            if (anyStepperActive()) {
                channelOff(servoChannel(i));
            } else {
                setChannel(servoChannel(i), 0, counts);
            }
        }
    }

    function warnServoWhileStepping(): void {
        if (warningShown) return;
        warningShown = true;
        serial.writeLine("DF-Motor: servo is paused while a stepper motor is running");
        basic.showLeds(`
            . . # . .
            . . # . .
            . . # . .
            . . . . .
            . . # . .
            `, 0);
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
        ensureReady();
        let duty = Math.round(Math.constrain(speed, 0, 255) * (PERIOD - 1) / 255);
        let low = motorChannel(index);
        let drive = direction == Dir.CW ? low + 1 : low;
        let idle = direction == Dir.CW ? low : low + 1;
        channelOff(idle);
        if (duty == 0) {
            channelOff(drive);
        } else {
            setChannel(drive, 0, duty);
        }
    }

    /**
     * Stop specific DC motor.
     * @param index Motor index (M1~M4)
     */
    //% block="motor %index|stop"
    //% weight=95
    export function motorStop(index: Motors): void {
        ensureReady();
        let low = motorChannel(index);
        channelOff(low);
        channelOff(low + 1);
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
        ensureReady();
        let us = SERVO_MIN_US + (SERVO_MAX_US - SERVO_MIN_US) * Math.constrain(degree, 0, 180) / 180;
        servoCounts[index - 1] = Math.round(us * SERVO_HZ * PERIOD / 1000000);
        if (anyStepperActive()) {
            warnServoWhileStepping();
            return;
        }
        setChannel(servoChannel(index), 0, servoCounts[index - 1]);
    }

    // ==========================================
    // 3. Stepper Motor Control
    // ==========================================

    // STEP1 uses M1 + M2 (channel 4~7), STEP2 uses M3 + M4 (channel 0~3).
    // Coil A is on M1 / M3, coil B is on M2 / M4 (the lower channels).
    function stepperFirstChannel(index: Steppers): number {
        return motorChannel(index == Steppers.M1 ? 2 : 4);
    }

    // on/off counts for the low and high input of one coil. The coil is
    // forward for half a PWM cycle from `quarter` (0~3) and reverse for the rest.
    function coilCounts(quarter: number): number[] {
        let fwd = quarter * PERIOD / 4;
        let rev = ((quarter + 2) % 4) * PERIOD / 4;
        return [rev, fwd, fwd, rev];
    }

    // Two-phase full step: coil B is a quarter cycle apart from coil A,
    // so one PWM cycle = 4 full steps. All 4 channels change at once.
    function driveStepper(index: Steppers, cw: boolean): void {
        let coilB = coilCounts(cw ? 0 : 3);
        let coilA = coilCounts(cw ? 3 : 0);
        setChannels(stepperFirstChannel(index), coilB.concat(coilA));
    }

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
     * @param wait Wait until the move is done, or go to the next block at once
     */
    //% block="stepper %index| move %dir| || degree %degree| speed(steps/s) %speed| %wait"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode=inline
    //% degree.defl=0 degree.min=0
    //% speed.defl=0 speed.min=0
    //% weight=65
    export function moveStepper(index: Steppers, dir: StepperDir, degree: number, speed: number, wait: StepperWait = StepperWait.Wait): void {
        ensureReady();
        let cfg = stepperConfigs[index - 1];
        let cw = (dir == StepperDir.CW) != cfg.inverted;
        let stepsPerSec = speed > 0 ? Math.min(speed, cfg.maxSpeed) : cfg.maxSpeed;
        let hz = Math.constrain(Math.round(stepsPerSec / 4), MIN_HZ, MAX_HZ);

        // Already turning the same way at the same speed (e.g. called again
        // in "forever"): keep the waveform as it is.
        let i = index - 1;
        let turning = stepperActive[i] && stepperCw[i] == cw && hz == pwmHz;
        if (!turning) {
            stepperActive[i] = true;
            stepperCw[i] = cw;
            // stop servo pulses before the frequency changes
            updateServoOutputs();
            if (hz != pwmHz) setPwmHz(hz);
            driveStepper(index, cw);
        }

        stepperMoveId[i]++;
        if (degree <= 0) return;    // keep turning until "stop"

        let moveId = stepperMoveId[i];
        let ms = (degree * cfg.stepsPerRev / 360) * 1000 / (actualHz * 4);
        let finish = () => {
            basic.pause(ms);
            if (stepperMoveId[i] == moveId) stopStepper(index);
        };
        if (wait == StepperWait.NoWait) {
            control.inBackground(finish);
        } else {
            finish();
        }
    }

    /**
     * Stop stepper motor.
     * @param index Stepper index (STEP1 / STEP2)
     */
    //% block="stepper %index| stop"
    //% weight=60
    export function stopStepper(index: Steppers): void {
        if (pwmHz == 0) return;
        ensureReady();
        let off: number[] = [];
        for (let ch = 0; ch < 4; ch++) {
            off.push(0);
            off.push(FULL_OFF);
        }
        setChannels(stepperFirstChannel(index), off);
        stepperActive[index - 1] = false;
        stepperMoveId[index - 1]++;
        if (!anyStepperActive()) {
            if (pwmHz != SERVO_HZ) setPwmHz(SERVO_HZ);
            updateServoOutputs();
        }
    }
}
