// Thai QR (PromptPay) payments. Body, one of:
//   { action: "create",  orderId }               customer (own order) or staff → QR for a cafe order
//   { action: "create",  amount, reference }     staff only → QR for a charge at the desk
//   { action: "status",  intentId }              → current status (expires stale QR codes)
//   { action: "slip",    intentId, slipQr, slipImagePath? }  customer or staff → attach their bank slip
//   { action: "confirm", intentId }              staff → money seen in the bank, mark paid
//   { action: "cancel",  intentId }              customer (own) or staff
// QR codes are built by _shared/promptpay.ts, an exact copy of lib/payments/promptpay.ts.
import { billRef, isPromptPayId, promptPayPayload, readSlipQr } from "../_shared/promptpay.ts";
import { adminClient, caller, handle, HttpError, json } from "../_shared/http.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const QR_MINUTES = 15;

type Intent = {
  id: string;
  purpose: "cafe_order" | "desk";
  cafe_order_id: string | null;
  reference: string;
  member_id: string | null;
  user_id: string | null;
  amount: number;
  promptpay_id: string;
  qr_payload: string;
  status: "pending" | "slip_sent" | "paid" | "expired" | "cancelled";
  expires_at: string;
  paid_at: string | null;
  slip_trans_ref: string | null;
  slip_bank: string | null;
};

const view = (i: Intent) => ({
  id: i.id,
  reference: i.reference,
  amount: Number(i.amount),
  status: i.status,
  qrPayload: i.qr_payload,
  promptPayId: i.promptpay_id,
  expiresAt: i.expires_at,
  paidAt: i.paid_at,
  slipBank: i.slip_bank,
});

/** The gym's PromptPay number: Admin → Site & content → Business, else the PROMPTPAY_ID secret. */
async function gymPromptPayId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "catalog:business").maybeSingle();
  const id = (data?.value as { promptPayId?: string } | null)?.promptPayId || Deno.env.get("PROMPTPAY_ID") || "";
  if (!isPromptPayId(id)) throw new HttpError(503, "QR payments aren't set up yet. Please pay at the counter.");
  return id;
}

async function loadIntent(admin: SupabaseClient, id: unknown): Promise<Intent> {
  const { data } = await admin.from("payment_intents").select("*").eq("id", String(id ?? "")).maybeSingle<Intent>();
  if (!data) throw new HttpError(404, "Payment not found.");
  return data;
}

/** A QR past its time is expired, unless a slip is already waiting for staff. */
async function refresh(admin: SupabaseClient, i: Intent): Promise<Intent> {
  if (i.status !== "pending" || new Date(i.expires_at) > new Date()) return i;
  const { data } = await admin
    .from("payment_intents")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", i.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle<Intent>();
  return data ?? (await loadIntent(admin, i.id));
}

Deno.serve(
  handle(async (req) => {
    const { user, userClient } = await caller(req);
    const { data: staffFlag } = await userClient.rpc("is_staff");
    const isStaff = staffFlag === true;
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const now = new Date();

    const mine = (i: Intent) => {
      if (!isStaff && i.user_id !== user.id) throw new HttpError(404, "Payment not found.");
    };

    switch (body.action) {
      case "create": {
        const promptPayId = await gymPromptPayId(admin);
        const expiresAt = new Date(now.getTime() + QR_MINUTES * 60_000).toISOString();

        if (body.orderId) {
          const { data: order } = await admin
            .from("cafe_orders")
            .select("id, number, subtotal, payment_status, member_id, status")
            .eq("id", String(body.orderId))
            .maybeSingle();
          if (!order) throw new HttpError(404, "Order not found.");
          const { data: me } = await admin.from("members").select("id").eq("user_id", user.id).maybeSingle();
          if (!isStaff && (!me || order.member_id !== me.id)) throw new HttpError(404, "Order not found.");
          if (order.payment_status === "paid") throw new HttpError(409, "This order is already paid.");
          if (order.status === "cancelled") throw new HttpError(409, "This order was cancelled.");

          // Same order, same amount, still valid: show the same QR rather than a second one.
          const { data: open } = await admin
            .from("payment_intents")
            .select("*")
            .eq("cafe_order_id", order.id)
            .in("status", ["pending", "slip_sent"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<Intent>();
          if (open) {
            const fresh = await refresh(admin, open);
            if (fresh.status !== "expired" && Number(fresh.amount) === Number(order.subtotal)) return json(view(fresh));
          }

          const { data, error } = await admin
            .from("payment_intents")
            .insert({
              purpose: "cafe_order",
              cafe_order_id: order.id,
              reference: order.number,
              member_id: order.member_id,
              user_id: isStaff ? null : user.id,
              amount: order.subtotal,
              promptpay_id: promptPayId,
              qr_payload: promptPayPayload(promptPayId, Number(order.subtotal)),
              expires_at: expiresAt,
              created_by: user.id,
            })
            .select("*")
            .single<Intent>();
          if (error) throw error;
          await admin.from("cafe_orders").update({ payment_method: "promptpay", payment_status: "pending", updated_at: now.toISOString() }).eq("id", order.id);
          return json(view(data));
        }

        if (!isStaff) throw new HttpError(403, "Staff only.");
        const amount = Number(body.amount);
        let payload: string;
        try {
          payload = promptPayPayload(promptPayId, amount);
        } catch (e) {
          throw new HttpError(400, (e as Error).message);
        }
        const { data, error } = await admin
          .from("payment_intents")
          .insert({
            purpose: "desk",
            reference: billRef(String(body.reference ?? "")) || "DESK",
            member_id: body.memberId ?? null,
            amount,
            promptpay_id: promptPayId,
            qr_payload: payload,
            expires_at: expiresAt,
            created_by: user.id,
          })
          .select("*")
          .single<Intent>();
        if (error) throw error;
        return json(view(data));
      }

      case "status": {
        const i = await loadIntent(admin, body.intentId);
        mine(i);
        return json(view(await refresh(admin, i)));
      }

      case "slip": {
        const i = await loadIntent(admin, body.intentId);
        mine(i);
        if (i.status === "paid") return json(view(i));
        if (i.status === "cancelled") throw new HttpError(409, "This payment was cancelled.");
        const read = readSlipQr(String(body.slipQr ?? ""));
        if (!read.ok) {
          throw new HttpError(
            400,
            read.error === "payment-qr"
              ? "That's our payment QR. Scan the small QR on your bank slip instead."
              : "We couldn't read that slip. Try the QR on the slip again, or show it at the counter.",
          );
        }
        const imagePath = body.slipImagePath ? String(body.slipImagePath) : null;
        if (imagePath && !isStaff && !imagePath.startsWith(`${user.id}/`)) throw new HttpError(400, "Upload the slip to your own folder.");
        const { data, error } = await admin
          .from("payment_intents")
          .update({
            status: "slip_sent",
            slip_trans_ref: read.slip.transRef,
            slip_bank: read.slip.bank ?? read.slip.bankCode,
            slip_image_path: imagePath,
            slip_submitted_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", i.id)
          .in("status", ["pending", "expired", "slip_sent"])
          .select("*")
          .maybeSingle<Intent>();
        // unique index on slip_trans_ref: the same slip can't pay for two things
        if (error?.code === "23505") throw new HttpError(409, "This slip has already been used for another payment.");
        if (error) throw error;
        // To confirm automatically: verify read.slip.transRef with your bank's slip API here, run
        // checkSlip() from _shared/promptpay.ts on the result, and if ok set status 'paid', confirmed_via 'slip'.
        return json(view(data ?? (await loadIntent(admin, i.id))));
      }

      case "confirm": {
        if (!isStaff) throw new HttpError(403, "Staff only.");
        const i = await loadIntent(admin, body.intentId);
        if (i.status === "paid") return json(view(i));
        if (i.status === "cancelled") throw new HttpError(409, "This payment was cancelled.");
        const { data, error } = await admin
          .from("payment_intents")
          .update({ status: "paid", paid_at: now.toISOString(), confirmed_by: user.id, confirmed_via: "staff", updated_at: now.toISOString() })
          .eq("id", i.id)
          .neq("status", "paid")
          .select("*")
          .maybeSingle<Intent>();
        if (error) throw error;
        await admin.from("activity").insert({
          member_id: i.member_id,
          type: "payment.promptpay",
          message: `PromptPay ฿${Number(i.amount).toLocaleString("en-US")} for ${i.reference} confirmed${i.slip_trans_ref ? ` (slip ${i.slip_trans_ref})` : ""}`,
        });
        return json(view(data ?? (await loadIntent(admin, i.id))));
      }

      case "cancel": {
        const i = await loadIntent(admin, body.intentId);
        mine(i);
        if (i.status === "paid") throw new HttpError(409, "This payment is already paid. Refund it at the counter.");
        const { data } = await admin
          .from("payment_intents")
          .update({ status: "cancelled", updated_at: now.toISOString() })
          .eq("id", i.id)
          .neq("status", "paid")
          .select("*")
          .maybeSingle<Intent>();
        if (i.cafe_order_id) {
          await admin.from("cafe_orders").update({ payment_status: "unpaid", updated_at: now.toISOString() }).eq("id", i.cafe_order_id).neq("payment_status", "paid");
        }
        return json(view(data ?? (await loadIntent(admin, i.id))));
      }

      default:
        throw new HttpError(400, "Unknown action.");
    }
  }),
);
