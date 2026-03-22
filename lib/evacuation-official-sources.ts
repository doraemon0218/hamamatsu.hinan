/**
 * 訓練画面の「指定避難場所」表示の根拠となる、行政公開データ・公式ページ。
 * lib/regions.ts の各スポットの isDesignatedEvacuationSite は、下記を人手で照合した結果に基づく。
 * データ更新時は CSV / 公式ページを再取得し、名称・座標を突き合わせてください。
 */

import type { RegionId } from "./regions";

export type EvacuationOfficialSource = {
  label: string;
  href: string;
};

export type EvacuationOfficialMeta = {
  /** UI用の短い説明 */
  summary: string;
  /** 照合のしかた（ユーザー向け） */
  matchingNote: string;
  sources: EvacuationOfficialSource[];
};

const HAMAMATSU: EvacuationOfficialMeta = {
  summary:
    "静岡県オープンデータ「指定緊急避難場所一覧」（浜松市・221309_evacuation_space.csv）の「名称」列に、当アプリの地点名と一致するものがあるかで判定しています。",
  matchingNote:
    "浜松アクトタワー・浜松駅前ビルは当該 CSV の名称一覧に該当施設がありませんでした。市の「津波避難ビル一覧」HTML掲載分でも駅前周辺の当該名称は確認できず（別紙 PDF には未機械照合）。",
  sources: [
    {
      label: "静岡県オープンデータ「指定緊急避難場所一覧」（浜松市）",
      href: "https://opendata.pref.shizuoka.jp/dataset/10983.html",
    },
    {
      label: "浜松市「津波避難ビルの指定について」",
      href: "https://www.city.hamamatsu.shizuoka.jp/kiki/disaster/bousai/building/",
    },
  ],
};

const KUSHIMOTO: EvacuationOfficialMeta = {
  summary:
    "デジタル庁 BODiK「【和歌山県】避難先情報一覧」内の串本町 CSV における施設名（例：県営住宅串本団地、サンゴ台集会所、串本中学校、串本古座高校）との対応で判定しています。",
  matchingNote:
    "東牟婁振興局串本建設部は当該 CSV の施設名として掲載がありません。「串本橋北詰付近」は地点ラベルであり一覧上の指定施設名との一致なしとして参考地点扱いです。",
  sources: [
    {
      label: "BODiK「【和歌山県】避難先情報一覧」データセット",
      href: "https://data.bodik.jp/dataset/300004_w090200_hinanjo",
    },
    {
      label: "避難先情報一覧 串本町CSV（上記データセット内リソース）",
      href: "https://data.bodik.jp/dataset/300004_w090200_hinanjo/resource/cb08738f-055e-4b68-a2de-02cdd0ea8983",
    },
    {
      label: "串本町「避難場所一覧」",
      href: "https://www.town.kushimoto.wakayama.jp/bousai/hinan-basho.html",
    },
  ],
};

const UMEDA: EvacuationOfficialMeta = {
  summary:
    "大阪市北区「津波避難ビルの一覧【民間施設】」（令和7年4月1日付ページ掲載の表）の施設名称に、当アプリの地点が含まれるかで判定しています。",
  matchingNote:
    "グランフロント大阪（北館）は表中「グランフロント大阪 南館、北館」と同一指定として掲載あり。大阪駅・梅田スカイビル・阪急百貨店・梅田ツインタワーズ・ヒルトン大阪・「周辺ビル」は当該民間施設一覧の名称としては確認できず（指定緊急避難場所の他区分・別資料での指定の可能性は別途ハザードマップ等で確認）。",
  sources: [
    {
      label: "大阪市北区「津波避難ビルの一覧【民間施設】」",
      href: "https://www.city.osaka.lg.jp/kita/page/0000299035.html",
    },
    {
      label: "大阪市「指定緊急避難場所・指定避難所の指定について」（一覧 PDF）",
      href: "https://www.city.osaka.lg.jp/kikikanrishitsu/page/0000349214.html",
    },
  ],
};

export function getEvacuationOfficialMeta(regionId: RegionId): EvacuationOfficialMeta {
  switch (regionId) {
    case "kushimoto":
      return KUSHIMOTO;
    case "umeda":
      return UMEDA;
    default:
      return HAMAMATSU;
  }
}
