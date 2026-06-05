import { MessagesSquare } from "lucide-react";
import { createVacancy } from "./actions";
import { Button } from "@/components/ui/button";

export default function AppHome() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessagesSquare className="size-6" />
      </div>
      <h1 className="text-lg font-medium">Создайте вакансию</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Опишите роль в чате — AI задаст уточняющие вопросы, соберёт описание и
        вопросы для видеоинтервью.
      </p>
      <form action={createVacancy} className="mt-6">
        <Button type="submit">Новая вакансия</Button>
      </form>
    </div>
  );
}
