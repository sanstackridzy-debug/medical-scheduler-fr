import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins may delete accounts");

    if (data.userId === userId) throw new Error("You cannot delete your own account");

    // Prevent deleting other admins
    const { data: targetIsAdmin } = await supabase.rpc("has_role", {
      _user_id: data.userId,
      _role: "admin",
    });
    if (targetIsAdmin) throw new Error("Admin accounts cannot be deleted");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Notify user before deletion (best-effort in-app record; will be removed with cascade)
    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      kind: "account_deleted",
      title: "Account removed",
      body: "Your account has been removed by an administrator.",
    });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; newPassword: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins may reset passwords");

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (data.userId !== userId) {
      const { data: targetIsAdmin } = await supabase.rpc("has_role", {
        _user_id: data.userId,
        _role: "admin",
      });
      if (targetIsAdmin) throw new Error("Admin passwords cannot be reset by another admin");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      kind: "password_reset",
      title: "Password reset",
      body: "An administrator reset your password. Please sign in with the new password and change it from your profile.",
    });

    return { ok: true };
  });

