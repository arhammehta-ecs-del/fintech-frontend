import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SessionTimeoutDialogProps = {
  open: boolean;
  countdown: number;
  onLogoutNow: () => void;
  onStaySignedIn: () => void;
};

export function SessionTimeoutDialog({
  open,
  countdown,
  onLogoutNow,
  onStaySignedIn,
}: SessionTimeoutDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session expiring soon</DialogTitle>
          <DialogDescription>
            You will be logged out in {countdown} seconds due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onLogoutNow}>
            Logout now
          </Button>
          <Button onClick={onStaySignedIn}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SessionTimeoutDialog;
