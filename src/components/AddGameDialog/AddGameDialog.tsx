import { useState } from "react";
import { Dialog, DialogTrigger, DialogPopup } from "@/components/ui/dialog";
import { AddGameContent } from "./AddGameContent";

export type AddGameDialogProps = {
  trigger: React.ReactElement;
};

export const AddGameDialog = ({ trigger }: AddGameDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [paths, setPaths] = useState<string[]>([]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) return;
    setName("");
    setPaths([]);
  };

  const handleClose = () => {
    setName("");
    setPaths([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />

      <DialogPopup className="max-w-md">
        <AddGameContent
          name={name}
          paths={paths}
          onNameChange={setName}
          onPathsChange={setPaths}
          onClose={handleClose}
        />
      </DialogPopup>
    </Dialog>
  );
};
