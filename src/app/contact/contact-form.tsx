"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRightIcon, ChevronDownIcon } from "../shell-icons";
import { contactLimits, contactReport, contactTopics, type ContactFields } from "./contact-fields";

const emptyFields: ContactFields = {
  name: "", email: "", topic: "help", message: "", browser: "", steps: "", expected: "", actual: "", website: "",
};
const sendError = "We couldn't confirm your message was sent. Your draft is still here. Try again later or copy it for GitHub.";

export function ContactForm() {
  const [fields, setFields] = useState(emptyFields);
  const [availability, setAvailability] = useState<"checking" | "ready" | "unavailable">("checking");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let mounted = true;
    fetch("/api/contact", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data: unknown = await response.json();
        if (mounted) setAvailability(response.ok && !!data && typeof data === "object" && "available" in data && data.available === true ? "ready" : "unavailable");
      })
      .catch(() => { if (mounted) setAvailability("unavailable"); })
      .finally(() => clearTimeout(timeout));
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, []);

  function updateField(key: keyof ContactFields, value: string) {
    setFields(previous => ({ ...previous, [key]: value }));
    setStatus("idle");
    setError("");
    setCopyStatus("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (availability !== "ready" || sending.current) return;
    sending.current = true;
    setStatus("pending");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields), signal: AbortSignal.timeout(12000),
      });
      const result: unknown = await response.json();
      if (response.ok && !!result && typeof result === "object" && "accepted" in result && result.accepted === true) {
        setStatus("success");
      } else {
        if (response.status === 503) setAvailability("unavailable");
        setError(response.status === 400 || response.status === 413 ? "Check your fields and keep your message within the character limits." : sendError);
        setStatus("error");
      }
    } catch {
      setError(sendError);
      setStatus("error");
    } finally { sending.current = false; }
  }

  const report = contactReport(fields);
  const githubUrl = new URL("https://github.com/MedLines/keepall/issues/new");
  githubUrl.searchParams.set("title", `[${contactTopics[fields.topic]}]`);
  githubUrl.searchParams.set("body", report);
  const longReport = githubUrl.href.length > 8000;

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Report copied. Review it before posting publicly.");
    } catch {
      setShowReport(true);
      setCopyStatus("Select the report below and copy it.");
      requestAnimationFrame(() => { reportRef.current?.focus(); reportRef.current?.select(); });
    }
  }

  return <div className="kc-contact">
    <div className="kc-availability" role="status">
      {availability === "checking" && "Checking email availability…"}
      {availability === "unavailable" && "Email sending isn't available yet. You can still write your message and copy it or open a GitHub draft below."}
      {availability === "ready" && "Send a message and we'll reply to your email."}
    </div>
    <form onSubmit={submit} className="kc-form" aria-label="Contact Keepall" aria-describedby="contact-privacy">
      <fieldset disabled={status === "pending"}>
        <legend className="kc-sr-only">Your message</legend>
        <div className="kc-pair">
          <div className="kc-field"><label htmlFor="contact-name">Name</label><input id="contact-name" name="name" autoComplete="name" value={fields.name} required maxLength={contactLimits.name} onChange={event => updateField("name", event.target.value)} /></div>
          <div className="kc-field"><label htmlFor="contact-email">Email</label><input id="contact-email" name="email" type="email" autoComplete="email" value={fields.email} required maxLength={contactLimits.email} onChange={event => updateField("email", event.target.value)} /></div>
        </div>
        <div className="kc-field"><label htmlFor="contact-topic">Topic</label><div className="kc-select"><select id="contact-topic" name="topic" value={fields.topic} onChange={event => updateField("topic", event.target.value)}>{Object.entries(contactTopics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDownIcon aria-hidden="true" /></div></div>
        <div className="kc-field"><label htmlFor="contact-message">Message</label><textarea id="contact-message" name="message" value={fields.message} rows={6} required maxLength={contactLimits.message} aria-describedby="contact-message-hint" onChange={event => updateField("message", event.target.value)} /><span id="contact-message-hint" className="kc-hint">What can we help with? Up to 5,000 characters.</span></div>
        {fields.topic === "bug" && <fieldset className="kc-bug-fields"><legend>Help us reproduce the bug</legend><p className="kc-hint">These details are optional. Include what you know.</p>
          <div className="kc-field"><label htmlFor="contact-browser">Browser and device</label><input id="contact-browser" name="browser" placeholder="For example, Chrome 140 on Windows 11" value={fields.browser} maxLength={contactLimits.browser} onChange={event => updateField("browser", event.target.value)} /></div>
          <div className="kc-field"><label htmlFor="contact-steps">Steps to reproduce</label><textarea id="contact-steps" name="steps" value={fields.steps} rows={3} maxLength={contactLimits.steps} onChange={event => updateField("steps", event.target.value)} /></div>
          <div className="kc-pair"><div className="kc-field"><label htmlFor="contact-expected">Expected result</label><textarea id="contact-expected" name="expected" value={fields.expected} rows={3} maxLength={contactLimits.expected} onChange={event => updateField("expected", event.target.value)} /></div><div className="kc-field"><label htmlFor="contact-actual">Actual result</label><textarea id="contact-actual" name="actual" value={fields.actual} rows={3} maxLength={contactLimits.actual} onChange={event => updateField("actual", event.target.value)} /></div></div>
        </fieldset>}
        <div className="kc-trap" aria-hidden="true"><label htmlFor="contact-website">Leave this field empty</label><input id="contact-website" name="website" value={fields.website} maxLength={contactLimits.website} autoComplete="off" tabIndex={-1} onChange={event => updateField("website", event.target.value)} /></div>
        <p id="contact-privacy" className="kc-hint">Sending shares these fields with Keepall support through Resend. Your library is never attached. Please leave out private links, notes, and backups. <Link href="/privacy">Privacy details</Link>.</p>
        <button className="ka-button kc-send" type="submit" disabled={availability !== "ready" || status === "pending" || status === "success"}>{status === "pending" ? "Sending…" : status === "success" ? "Message submitted" : "Send message"}<ArrowRightIcon /></button>
      </fieldset>
      {status === "success" && <p className="kc-result" role="status">Your message was submitted. We&apos;ll reply to the email you provided.</p>}
      {status === "error" && <p className="kc-result" role="alert">{error}</p>}
    </form>
    <aside className="kc-fallback" aria-labelledby="contact-github-title">
      <h3 id="contact-github-title">Prefer GitHub?</h3><p>GitHub issues are public and need a GitHub account. <a href="https://github.com/MedLines/keepall/issues" target="_blank" rel="noreferrer">Browse existing issues</a> or share a report. The report below includes your message and bug details, with your name and email left out. Review it for private information before posting.</p>
      <div className="kc-actions"><button className="ka-button" type="button" onClick={copyReport}>Copy report</button><a className="ka-button" href={longReport ? "https://github.com/MedLines/keepall/issues/new" : githubUrl.href} target="_blank" rel="noreferrer">{longReport ? "Open GitHub issue" : "Open GitHub draft"} <ArrowRightIcon /></a></div>
      {longReport && <p className="kc-hint">This report is too long for a GitHub link. Copy the report and paste it into your issue.</p>}
      <p role="status" className="kc-hint">{copyStatus}</p>
      <details open={showReport} onToggle={event => setShowReport(event.currentTarget.open)}><summary>Review report</summary><textarea ref={reportRef} aria-label="Report to copy" value={report} readOnly rows={8} /></details>
    </aside>
  </div>;
}
