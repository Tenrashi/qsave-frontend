import { useState } from "react";
import { Dialog, DialogTrigger, DialogPopup } from "@/components/ui/dialog";
import { RemoveGameContent } from "./RemoveGameContent";

export type RemoveGameDialogProps = {
  trigger: React.ReactElement;
  onConfirm: () => void;
};

export const RemoveGameDialog = ({
  trigger,
  onConfirm,
}: RemoveGameDialogProps) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogPopup className="max-w-sm">
        <RemoveGameContent onConfirm={handleConfirm} />
      </DialogPopup>
    </Dialog>
  );
};
