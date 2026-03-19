import { useState } from "react";
import { Dialog, DialogTrigger, DialogPopup } from "@/components/ui/dialog";
import type { Game } from "@/domain/types";
import { RestoreContent } from "./RestoreContent";

export type RestoreDialogProps = {
  game: Game;
  trigger: React.ReactElement;
  quick?: boolean;
};

export const RestoreDialog = ({ game, trigger, quick }: RestoreDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogPopup className="max-w-md">
        <RestoreContent game={game} quick={quick} open={open} />
      </DialogPopup>
    </Dialog>
  );
};
