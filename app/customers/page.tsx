import Link from "next/link";
import { ArrowUpRight, Mail, Phone, UserRound, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

function relativeDate(value:string|null){
  if(!value) return "No contact yet";
  const diff=Math.max(0,Date.now()-new Date(value).getTime());
  const days=Math.floor(diff/86400000);
  if(days===0) return "Today";
  if(days===1) return "Yesterday";
  if(days<30) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
}

export default async function CustomersPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id,full_name,phone,email,lead_status,last_contacted_at,created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const items=customers??[];
  const activeLeads=items.filter((customer:any)=>["warm","qualified"].includes(customer.lead_status)).length;

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="section-page command-page">
        <header className="section-header">
          <div>
            <div className="eyebrow">CRM</div>
            <h1>Customers</h1>
            <p>{business.name} · people your receptionist has spoken to and remembered.</p>
          </div>

          <div className="section-stat glass-chip">
            <UsersRound size={15} strokeWidth={1.7}/>
            <span><strong>{items.length}</strong> customers</span>
            <i/>
            <span><strong>{activeLeads}</strong> active leads</span>
          </div>
        </header>

        <section className="section-panel glass-surface customers-panel">
          <div className="section-panel-head">
            <div>
              <h2>Customer list</h2>
              <p>Open a profile to view history and customer details.</p>
            </div>
          </div>

          {items.length===0 ? (
            <div className="section-empty">
              <span><UsersRound size={21} strokeWidth={1.5}/></span>
              <strong>No customers yet</strong>
              <p>New customer profiles will appear as conversations happen.</p>
            </div>
          ) : (
            <div className="customer-clean-list">
              {items.map((customer:any)=>(
                <Link href={`/customers/${customer.id}`} key={customer.id} className="customer-clean-row">
                  <div className="customer-avatar"><UserRound size={17} strokeWidth={1.7}/></div>

                  <div className="customer-primary">
                    <strong>{customer.full_name ?? "Unnamed customer"}</strong>
                    <div>
                      {customer.phone && <span><Phone size={11}/>{customer.phone}</span>}
                      {!customer.phone && customer.email && <span><Mail size={11}/>{customer.email}</span>}
                      {!customer.phone && !customer.email && <span>No contact details</span>}
                    </div>
                  </div>

                  <div className="customer-lead-pill">{customer.lead_status || "new"}</div>

                  <div className="customer-contacted">
                    <span>Last contact</span>
                    <strong>{relativeDate(customer.last_contacted_at)}</strong>
                  </div>

                  <ArrowUpRight className="customer-arrow" size={15} strokeWidth={1.6}/>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
