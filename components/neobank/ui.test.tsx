import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { fmt, short, PageHeader, Card, Stat } from "./ui.tsx"

// Real component rendering (react-dom/server executes the components).

test("fmt: money with 2 decimals + thousands separators; null-safe", () => {
  assert.equal(fmt(1234.5), "1,234.50")
  assert.equal(fmt(undefined), "0.00")
})

test("short: truncates long ids with an ellipsis", () => {
  assert.equal(short("abc"), "abc")
  assert.ok(short("party-1234567890abcdef0000").includes("…"))
})

test("PageHeader renders an <h1> title + subtitle", () => {
  const html = renderToStaticMarkup(<PageHeader title="Console" subtitle="Treasury and payouts" />)
  assert.match(html, /<h1[^>]*>Console<\/h1>/)
  assert.match(html, /Treasury and payouts/)
})

test("Card renders its children", () => {
  assert.match(renderToStaticMarkup(<Card>Hello</Card>), /Hello/)
})

test("Stat renders label + value", () => {
  const html = renderToStaticMarkup(<Stat label="Balance" value="$100.00" />)
  assert.match(html, /Balance/)
  assert.match(html, /\$100\.00/)
})
