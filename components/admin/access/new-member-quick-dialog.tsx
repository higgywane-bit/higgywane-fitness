"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { memberships } from "@/lib/pricing";
import { createMemberAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

interface NewMemberQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}

export function NewMemberQuickDialog({ open, onOpenChange, onCreated }: NewMemberQuickDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const plans = memberships();
  const dayPass = plans.find((p) => p.id === "day");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!planId) {
      setError("Please select a plan");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createMemberAction({
          firstName: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          sell: {
            planId,
            paymentMethod: "other",
          },
        });

        if (!res.ok) {
          setError(res.error || "Failed to create member");
          return;
        }

        setName("");
        setPhone("");
        setEmail("");
        setPlanId("");
        onOpenChange(false);
        await onCreated();
      } catch (err) {
        setError("Something went wrong");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 pt-5 pb-4">
          <div>
            <DialogTitle className="text-lg font-semibold">Add New Member</DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">Quick add and start their membership</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-2">
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Name *
            </label>
            <Input
              placeholder="Member name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              autoFocus
              className="bg-white/5 border-white/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Phone
            </label>
            <Input
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={pending}
              type="tel"
              className="bg-white/5 border-white/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1.5">
              Email
            </label>
            <Input
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              type="email"
              className="bg-white/5 border-white/10"
            />
          </div>

          <div>
            <label htmlFor="plan" className="block text-sm font-medium text-white mb-1.5">
              Plan *
            </label>
            <select
              id="plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              disabled={pending}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-text-tertiary focus:border-white/20 focus:outline-none"
            >
              <option value="">Select a plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex gap-2 rounded-lg bg-red/10 border border-red p-3">
              <AlertCircle className="size-4 text-red shrink-0 mt-0.5" />
              <p className="text-sm text-red">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="flex-1 gap-2 bg-green hover:bg-green-hover"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Add Member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
