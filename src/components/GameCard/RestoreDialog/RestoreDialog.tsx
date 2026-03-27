import { useState } from "react";
import { Dialog, DialogTrigger, DialogPopup } from "@/components/ui/dialog";
import type { Game } from "@/domain/types";
import { RestoreContent } from "./RestoreContent/RestoreContent";

export type RestoreDialogProps = {
  game: Game;
  quick?: boolean;
} & (
  | { trigger: React.ReactElement; open?: never; onOpenChange?: never }
  | { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void }
);

export const RestoreDialog = ({
  game,
  trigger,
  quick,
  ...controlled
}: RestoreDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled.open ?? internalOpen;
  const setOpen = controlled.onOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogPopup className="max-w-md">
        <RestoreContent game={game} quick={quick} open={open} />
      </DialogPopup>
    </Dialog>
  );
};
