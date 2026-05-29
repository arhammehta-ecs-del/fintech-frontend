import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type EditLockWarningDialogProps = {
  open: boolean;
  secondsRemaining: number;
  onContinue: () => void;
  onCloseAndRelease: () => void;
};

export default function EditLockWarningDialog({
  open,
  secondsRemaining,
  onContinue,
  onCloseAndRelease,
}: EditLockWarningDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[460px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Continue editing?</DialogTitle>
          <DialogDescription>
            Continue editing this form before {secondsRemaining}s to keep your edit lock active.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCloseAndRelease}>Close Form</Button>
          <Button onClick={onContinue}>Continue Editing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
