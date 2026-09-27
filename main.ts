/**
 * DFRobot Motor Driver (DFR0548) 日本語版 MakeCode 拡張機能
 * PCA9685 PWM波形自動出力方式
 */
//% color="#6b3ba7" weight=100 icon="\f1b9" block="DF-Motor"

namespace dfmotor {
    // (以降のコードは変更なし)namespace dfmotor {
    const PCA9685_ADDRESS = 0x59;
    const MODE1 = 0x00;
    const PRESCALE = 0xFE;
    const LED0_ON_L = 0x06;

    // --- 列挙型の定義 ---

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
        //% block="正転"
        CW = 1,
        //% block="逆転"
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
        //% block="時計回り"
        CW = 1,
        //% block="反時計回り"
        CCW = 2
    }

    // ステッピングモーターの設定保持クラス
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

    // --- PCA9685 低レイヤー制御関数 ---

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
        let buf2 = pins.createBuffer(5);
        buf2[0] = LED0_ON_L + 4 * channel;
        buf2[1] = on & 0xFF;
        buf2[2] = (on >> 8) & 0xFF;
        buf2[3] = off & 0xFF;
        buf2[4] = (off >> 8) & 0xFF;
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf2);
    }

    // ==========================================
    // 1. DCモーター制御ブロック
    // ==========================================

    /**
     * DCモーターを回転させます。
     * @param index モーターの指定 (M1~M4)
     * @param direction 回転方向 (正転/逆転)
     * @param speed スピード (0~255), eg: 150
     */
    //% block="モーター %index|を %direction|方向に スピード %speed|で回す"
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
     * 特定のDCモーターを停止します。
     * @param index モーターの指定 (M1~M4)
     */
    //% block="モーター %index|を止める"
    //% weight=95
    export function motorStop(index: Motors): void {
        if (!initialized) {
            initPCA9685();
        }
        let pnp2 = (index - 1) * 2;
        setPwm(pnp2, 0, 0);
        setPwm(pnp2 + 1, 0, 0);
    }

    /**
     * すべてのDCモーターを停止します。
     */
    //% block="すべてのDCモーターを止める"
    //% weight=90
    export function motorStopAll(): void {
        for (let idx = 1; idx <= 4; idx++) {
            motorStop(idx);
        }
    }

    // ==========================================
    // 2. サーボモーター制御ブロック
    // ==========================================

    /**
     * サーボモーターの角度を設定します。
     * @param index サーボの指定 (S1~S8)
     * @param degree 角度 (0~180度), eg: 90
     */
    //% block="サーボ %index|の角度を %degree|度にする"
    //% degree.min=0 degree.max=180 degree.defl=90
    //% inlineInputMode=inline
    //% weight=80
    export function servoRun(index: Servos, degree: number): void {
        if (!initialized) {
            initPCA9685();
        }
        degree = Math.max(0, Math.min(180, degree));
        let pulse = Math.floor(102 + (degree * 410) / 180);
        let channel = index + 7;
        setPwm(channel, 0, pulse);
    }

    // ==========================================
    // 3. ステッピングモーター制御ブロック
    // ==========================================

    /**
     * ステッピングモーターの基本設定を行います。
     * @param index モーターの指定 (STEP1 / STEP2)
     * @param stepsPerRev 1周のステップ数, eg: 2048
     * @param inverted 回転方向を反転するか
     * @param maxSpeed 最速速度 (ステップ/秒), eg: 400
     */
    //% block="ステッピング %index| の初期設定 | 1周のステップ数: %stepsPerRev| 回転方向反転: %inverted| 最速速度(ステップ/秒): %maxSpeed"
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
     * ステッピングモーターを回転させます（角度・速度の省略が可能）。
     * @param index モーターの指定 (STEP1 / STEP2)
     * @param dir 回転方向
     * @param degree 回転角度 (度, 0で無限回転), eg: 360
     * @param speed 速度 (ステップ/秒, 0で最速), eg: 200
     */
    //% block="ステッピング %index| を %dir| に回す || 角度 %degree|度 速度 %speed|ステップ/秒"
    //% expandableArgumentMode="toggle"
    //% inlineInputMode=inline
    //% degree.defl=0 degree.min=0
    //% speed.defl=0 speed.min=0
    //% weight=65
    export function moveStepper(index: Steppers, dir: StepperDir, degree: number, speed: number): void {
        if (!initialized) {
            initPCA9685();
        }

        let cfg2 = stepperConfigs[index - 1];

        // 実効回転方向の決定
        let effectiveDir = dir;
        if (cfg2.inverted) {
            effectiveDir = (dir === StepperDir.CW) ? StepperDir.CCW : StepperDir.CW;
        }

        // 速度設定（0以下なら最速値を設定）
        let targetSpeed = (speed <= 0) ? cfg2.maxSpeed : Math.min(speed, cfg2.maxSpeed);

        // PWM周波数を調整
        setFreq(targetSpeed);

        // 1-2相励磁パルス出力
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

        // 角度指定がある場合（0より大きい場合）は自動停止処理
        if (degree > 0) {
            let targetSteps = (degree / 360) * cfg2.stepsPerRev;
            let durationMs = (targetSteps / targetSpeed) * 1000;

            basic.pause(durationMs);
            stopStepper(index);
        }
    }

    /**
     * ステッピングモーターを停止します。
     * @param index モーターの指定 (STEP1 / STEP2)
     */
    //% block="ステッピング %index|を止める"
    //% weight=60
    export function stopStepper(index: Steppers): void {
        if (!initialized) return;
        let offset2 = (index - 1) * 4;
        for (let i = 0; i < 4; i++) {
            setPwm(offset2 + i, 0, 0);
        }
    }
}
