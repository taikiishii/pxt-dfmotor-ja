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

STEP1 は M1・M2 の端子、STEP2 は M3・M4 の端子につなぎます。

> **サーボとステッピングは同時に使えません。**
> 基板の PWM 周波数は全端子で共通で、ステッピングは速度に合わせて周波数を変えるためです。
> * ステッピングが回っている間、サーボには信号が出ません（止めると、最後に指定した角度に戻ります）。
> * ステッピングが回っている間にサーボのブロックを使うと、LED に「!」が出ます。
> * 速度はおよそ 96〜6000 ステップ/秒の範囲で動きます。

### 拡張ボードのスイッチを入れ直したとき

micro:bit を USB につないだまま拡張ボードのスイッチを OFF→ON にすると、ボードの設定が消えます。
次にこの拡張のブロックが実行されたときに自動で設定し直し、サーボは最後に指定した角度に戻ります。
モーターは、もう一度ブロックで回すまで止まったままです。

---

## このリポジトリを編集・開発する場合

1. [MakeCode for micro:bit](https://makecode.microbit.org/) を開きます。
2. **「読み込む」** ➔ **「URLから読み込む...」** を選択します。
3. `https://github.com/taikiishii/pxt-dfmotor-ja` を貼り付けてインポートします。

---

## ライセンス

v0.1.0 以降は [MIT License](LICENSE.txt) です。

v0.0.5 までの版は、DFRobot の [pxt-motor](https://github.com/DFRobot/pxt-motor)（GNU Lesser General Public License）をもとに作ったものです。
v0.1.0 で、PCA9685 のデータシートと基板の仕様をもとにコードを書き直しました。

---

#### メタデータ (検索・レンダリング用)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>