"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Waves, User, ChevronLeft, Save } from "lucide-react";
import {
  loadUserSettings,
  saveUserSettings,
  getLevel,
  getExpInCurrentLevel,
  XP_PER_LEVEL,
} from "@/lib/settings";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [hasMobilityDisability, setHasMobilityDisability] = useState(false);
  const [useInsulin, setUseInsulin] = useState(false);
  const [insulinUnitsPerDay, setInsulinUnitsPerDay] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [familyAddress, setFamilyAddress] = useState("");
  const [saved, setSaved] = useState(false);
  const [exp, setExp] = useState(0);

  useEffect(() => {
    const s = loadUserSettings();
    setDisplayName(s.displayName ?? "");
    setHeight(s.height);
    setWeight(s.weight);
    setBirthDate(s.birthDate);
    setGender(s.gender);
    setHasMobilityDisability(s.hasMobilityDisability);
    setUseInsulin(s.useInsulin);
    setInsulinUnitsPerDay(s.insulinUnitsPerDay);
    setHomeAddress(s.homeAddress);
    setWorkAddress(s.workAddress);
    setFamilyAddress(s.familyAddress);
    setExp(s.exp ?? 0);
  }, []);

  const handleSave = () => {
    const current = loadUserSettings();
    saveUserSettings({
      displayName: displayName.trim(),
      height,
      weight,
      birthDate,
      gender,
      hasMobilityDisability,
      useInsulin,
      insulinUnitsPerDay,
      exp: current.exp ?? 0,
      homeAddress,
      workAddress,
      familyAddress,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur">
        <div className="container mx-auto flex items-center gap-2 px-4 py-3">
          <Link
            href="/"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="ホームへ戻る"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Waves className="size-6 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold text-foreground">設定</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
        {/* アバター・避難レベル・経験値 */}
        <Card className="border-accent/30 bg-gradient-to-br from-card to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-accent/30"
                aria-hidden
              >
                <User className="size-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">避難レベル</p>
                <p className="text-2xl font-bold text-foreground">
                  Lv.{getLevel(exp)}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${(getExpInCurrentLevel(exp) / XP_PER_LEVEL) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {getExpInCurrentLevel(exp)} / {XP_PER_LEVEL} XP（次のレベルまで）
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" aria-hidden />
              あなたの情報
            </CardTitle>
            <CardDescription>
              表示名は訓練記録の提出先（行政）で表示されます。身長・体重・生年月日・性別・運動障害の有無。変更後は「設定を保存」を押してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">表示名（任意）</Label>
              <Input
                id="display-name"
                placeholder="例: 山田 太郎"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
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
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={hasMobilityDisability}
                  onChange={(e) => setHasMobilityDisability(e.target.checked)}
                  className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                />
                <span className="font-medium text-foreground">運動障害がある</span>
              </label>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={useInsulin}
                  onChange={(e) => setUseInsulin(e.target.checked)}
                  className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                />
                <span className="font-medium text-foreground">インスリンを使用している</span>
              </label>
              {useInsulin && (
                <div className="pl-7 space-y-2">
                  <Label htmlFor="insulin-units">1日あたりの皮下注単位</Label>
                  <Input
                    id="insulin-units"
                    type="number"
                    min={0}
                    max={500}
                    placeholder="例: 20"
                    value={insulinUnitsPerDay}
                    onChange={(e) => setInsulinUnitsPerDay(e.target.value)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>一時避難訓練のスタート地点（3か所）</CardTitle>
            <CardDescription>
              自宅・職場・最愛の家族の居場所。変更後は「設定を保存」を押してください。
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
              <Button type="button" size="sm" variant="outline" className="mt-1">
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
              <Button type="button" size="sm" variant="outline" className="mt-1">
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
              <Button type="button" size="sm" variant="outline" className="mt-1">
                現在地を登録する
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleSave}
          >
            <Save className="mr-2 size-4" />
            {saved ? "保存しました" : "設定を保存"}
          </Button>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
          >
            ホームに戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
