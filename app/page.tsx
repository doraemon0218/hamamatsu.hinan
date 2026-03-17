"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Waves, User, Bike, PersonStanding, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// 避難訓練の3つの移動手段（1つに絞らない）
const MOBILITY_MODES = [
  { id: "walk", label: "歩く", icon: PersonStanding, desc: "無理のない歩行で避難" },
  { id: "run", label: "走る", icon: Activity, desc: "駆け足で素早く避難" },
  { id: "bicycle", label: "自転車に乗る", icon: Bike, desc: "自転車で速やかに避難" },
] as const;

export default function Home() {
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [hasMobilityDisability, setHasMobilityDisability] = useState(false);
  const [homeAddress, setHomeAddress] = useState<string>("");
  const [workAddress, setWorkAddress] = useState<string>("");
  const [familyAddress, setFamilyAddress] = useState<string>("");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="container mx-auto flex items-center gap-2 px-4 py-3">
          <Waves className="size-6 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">
            いっとき避難トレーニング
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
        {/* ヒーロー（短く） */}
        <section>
          <Card className="overflow-hidden border-2 border-accent/40 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>南海トラフ地震・津波に備えて</CardDescription>
              <CardTitle className="text-xl leading-tight text-foreground sm:text-2xl">
                いつか必ず来る。だから今から、
                <span className="mt-1 block text-accent">「一時避難」を身につける</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                歩く・走る・自転車のそれぞれの状態で避難訓練ができます。
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 個人情報 ＋ 運動障害チェック */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" aria-hidden />
                あなたの情報
              </CardTitle>
              <CardDescription>
                身長・体重・生年月日・性別を入力し、運動障害の有無を選択してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="height">身長 (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min={100}
                    max={250}
                    placeholder="170"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">体重 (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min={30}
                    max={200}
                    placeholder="65"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">生年月日</Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-2">
                <Label>性別</Label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={gender === "male"}
                      onChange={(e) => setGender(e.target.value)}
                      className="size-4 border-input accent-primary"
                    />
                    <span className="text-sm">男性</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={gender === "female"}
                      onChange={(e) => setGender(e.target.value)}
                      className="size-4 border-input accent-primary"
                    />
                    <span className="text-sm">女性</span>
                  </label>
                </div>
              </div>

              {/* 運動障害があるか */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={hasMobilityDisability}
                    onChange={(e) => setHasMobilityDisability(e.target.checked)}
                    className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                    aria-describedby="mobility-disability-desc"
                  />
                  <div>
                    <span className="font-medium text-foreground">
                      運動障害がある
                    </span>
                    <p id="mobility-disability-desc" className="mt-1 text-sm text-muted-foreground">
                      身体の不自由さや持病などで、歩行・走行・自転車のいずれかに制限がある場合にチェックしてください
                    </p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 一時避難訓練のスタート地点（3か所） */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>一時避難訓練のスタート地点</CardTitle>
              <CardDescription>
                今後の避難訓練で使う「スタート地点」として、自宅・職場・最愛の家族の居場所を登録します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="home-address">自宅の住所</Label>
                <Input
                  id="home-address"
                  placeholder="例: 〇〇県〇〇市〇〇町..."
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1"
                >
                  現在地を登録する
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-address">職場の住所</Label>
                <Input
                  id="work-address"
                  placeholder="例: 勤務先の所在地..."
                  value={workAddress}
                  onChange={(e) => setWorkAddress(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1"
                >
                  現在地を登録する
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="family-address">最愛の家族の居場所</Label>
                <Input
                  id="family-address"
                  placeholder="例: 実家・パートナーの職場・よくいる場所など"
                  value={familyAddress}
                  onChange={(e) => setFamilyAddress(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1"
                >
                  現在地を登録する
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                入力した情報は、この端末内でのみ利用し、今後の避難訓練シナリオのスタート地点として使う想定です。
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 避難訓練：歩く・走る・自転車の3つ → 訓練ページへ */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>避難訓練の移動手段</CardTitle>
              <CardDescription>
                次の3つの状態それぞれで避難訓練ができます。どれからでも選べます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="grid gap-3 sm:grid-cols-3">
                {MOBILITY_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <li key={mode.id}>
                      <div
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-4 py-4 text-center"
                        )}
                      >
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="size-6" />
                        </div>
                        <span className="font-medium text-foreground">
                          {mode.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {mode.desc}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-center pt-2">
                <Link
                  href="/training"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                >
                  訓練を行う
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
