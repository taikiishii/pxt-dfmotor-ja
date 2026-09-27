# DF-Motor (DFRobot Motor Driver Board 用 MakeCode 拡張機能)

DFRobot 製 micro:bit 用モータードライバー基板 (**DFR0548**) を MakeCode で簡単に操作するための日本語版拡張機能です。  
DCモーター、サーボモーター、ステッピングモーターの制御に対応しています。

---

## 使い方 (拡張機能として追加)

1. [MakeCode for micro:bit](https://makecode.microbit.org/) を開きます。
2. **「新しいプロジェクト」** を作成します。
3. ツールボックス内（または歯車メニュー）にある **「拡張機能」** をクリックします。
4. 検索バーに以下の URL を貼り付けて検索し、インポートします。

https://github.com/taikiishii/pxt-dfmotor-ja

---

## 提供ブロック一覧

### 1. DCモーター (M1 ~ M4)
* **`モーター [M1~M4] を [正転/逆転] 方向に スピード [0~255] で回す`**
* **`モーター [M1~M4] を止める`**

### 2. サーボモーター (S1 ~ S8)
* **`サーボ [S1~S8] の角度を [0~180] 度にする`**

### 3. ステッピングモーター (STEP1 / STEP2)
* **`ステッピング [STEP1/STEP2] の初期設定 | 1周のステップ数: [2048] 回転方向反転: [真/偽] 最速速度(ステップ/秒): [400]`**
* **`ステッピング [STEP1/STEP2] を [時計回り/反時計回り] に回す (角度・速度指定可)`**
* **`ステッピング [STEP1/STEP2] を止める`**

---

## このリポジトリを編集・開発する場合

1. [MakeCode for micro:bit](https://makecode.microbit.org/) を開きます。
2. **「読み込む」** ➔ **「URLから読み込む...」** を選択します。
3. `https://github.com/taikiishii/pxt-dfmotor-ja` を貼り付けてインポートします。

---

#### メタデータ (検索・レンダリング用)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>