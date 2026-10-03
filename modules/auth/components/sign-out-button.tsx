import { Button } from '@/components/ui/button';
import { signOut } from '../lib/actions';

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
