---
order: 9
title: "Sales-intelligence agent"
type: Build
tracks: [LLMs, Tools]
blurb: "A multi-tool agent on Snowflake Cortex that answers sales questions from structured metrics and call transcripts, iterated with observability traces and exposed to Cursor over MCP."
meta: "Cortex Analyst · Cortex Search · MCP"
media: "[Diagram: a Cortex Agent routing questions from Cursor to Cortex Analyst and Cortex Search]"
image: "/media/sales-agent-architecture.png"
links:
  - label: "Course"
    href: "https://www.coursera.org/learn/building-ai-agents-with-snowflake"
ctaLabel: "Details"
---

## Overview

I built this agent during *Building AI Agents with Snowflake*, Snowflake's course on Coursera and part of its Generative AI Professional Certificate (2026). The scenario is B2B sales intelligence: questions that need deal metrics, conversation transcripts, or both to answer.

Unlike a chatbot that answers one prompt at a time, the agent plans. It breaks a question into steps, decides which tool each step needs, and combines what the tools return into one answer.

## How it works

- **Structured data, through Cortex Analyst.** A semantic view maps business language onto the sales tables. Dimensions slice the data, measures define calculations such as win rate, and synonyms let people phrase questions loosely. The agent asks in plain English and Analyst writes the SQL, so a question like "What's our win rate?" needs no hand-written query.
- **Unstructured data, through Cortex Search.** A search service over sales conversation transcripts lets the agent find what customers actually said.
- **The agent.** A Cortex Agent has both services as tools. Orchestration instructions set when to use each, how to split multi-step questions into tasks, and how to format the response.
- **Iterating with observability.** Snowflake's agent monitoring shows how each question was planned and which tools ran. I used these traces to find weak answers and refine the instructions.
- **Model Context Protocol.** A Snowflake-managed MCP server exposes the agent to Cursor, so it can be queried from outside Snowflake.

## Results

A working agent, available in Snowflake Intelligence and from Cursor over MCP, that decides on its own whether a question needs the metrics, the transcripts or both. I tested it on all three kinds of question.
