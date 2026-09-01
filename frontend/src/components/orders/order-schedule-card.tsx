"use client";

import type { JSX } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderType } from "@/types/orders";

export function OrderScheduleCard({
  deliveryAddress,
  deliveryTime,
  eventDate,
  notes,
  onChange,
  orderType,
  pickupTime,
}: {
  deliveryAddress: string;
  deliveryTime: string;
  eventDate: string;
  notes: string;
  onChange: (patch: {
    deliveryAddress?: string;
    deliveryTime?: string;
    eventDate?: string;
    notes?: string;
    orderType?: OrderType;
    pickupTime?: string;
  }) => void;
  orderType: OrderType;
  pickupTime: string;
}): JSX.Element {
  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-card/85 p-5">
      <h2 className="text-xl font-semibold text-brand-espresso">Schedule</h2>
      <p className="mt-1 text-sm text-brand-mocha">
        Set event date and pickup or delivery details.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="order-schedule-card-order-type">Order type</Label>
          <Select
            onValueChange={(value: OrderType) => onChange({ orderType: value })}
            value={orderType}
          >
            <SelectTrigger id="order-schedule-card-order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pickup">Pickup</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orderEventDate">Event date</Label>
          <Input
            id="orderEventDate"
            onChange={(event) => onChange({ eventDate: event.target.value })}
            type="date"
            value={eventDate}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orderPickupTime">Pickup time</Label>
          <Input
            disabled={orderType !== "pickup"}
            id="orderPickupTime"
            onChange={(event) => onChange({ pickupTime: event.target.value })}
            type="time"
            value={pickupTime}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orderDeliveryTime">Delivery time</Label>
          <Input
            disabled={orderType !== "delivery"}
            id="orderDeliveryTime"
            onChange={(event) => onChange({ deliveryTime: event.target.value })}
            type="time"
            value={deliveryTime}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="orderDeliveryAddress">Delivery address</Label>
          <textarea
            className="min-h-24 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso outline-none ring-offset-background placeholder:text-brand-mocha focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={orderType !== "delivery"}
            id="orderDeliveryAddress"
            onChange={(event) => onChange({ deliveryAddress: event.target.value })}
            placeholder="Delivery address"
            value={deliveryAddress}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="orderNotes">Notes</Label>
          <textarea
            className="min-h-24 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso outline-none ring-offset-background placeholder:text-brand-mocha focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2"
            id="orderNotes"
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="Internal order notes"
            value={notes}
          />
        </div>
      </div>
    </section>
  );
}
