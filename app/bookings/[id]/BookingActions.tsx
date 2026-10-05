"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function BookingActions({
  bookingId,
  status
}:{
  bookingId:string;
  status:string;
}) {
  const router = useRouter();
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");

  const cancellable=["pending","confirmed"].includes(status);

  async function cancelBooking(){
    if(!cancellable || working) return;
    const ok=window.confirm("Cancel this booking?");
    if(!ok) return;

    setWorking(true);
    setError("");

    const response=await fetch("/api/bookings",{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({bookingId,action:"cancel"})
    });
    const data=await response.json();

    if(!response.ok){
      setError(data.error||"Could not cancel booking");
      setWorking(false);
      return;
    }

    router.refresh();
    setWorking(false);
  }

  if(!cancellable && !error) return null;

  return (
    <div className="booking-detail-actions">
      {cancellable && (
        <button className="booking-cancel-action" onClick={cancelBooking} disabled={working}>
          <X size={14}/>
          {working ? "Cancelling…" : "Cancel booking"}
        </button>
      )}
      {error && <span className="booking-action-error">{error}</span>}
    </div>
  );
}
