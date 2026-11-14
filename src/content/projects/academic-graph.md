---
order: 8
title: "CS & robotics researcher atlas"
type: Build
tracks: [ML, Tools]
blurb: "A knowledge graph of the 1,000 most-cited researchers in computer science and robotics, each embedded with SPECTER2 from their most-cited papers. An interactive atlas maps them by research similarity, with Neo4j vector search behind it."
meta: "OpenAlex · SPECTER2 · UMAP · Neo4j"
media: "[Animation: the atlas's 3D map of 1,000 researchers turning, coloured by research area]"
image: "/media/academic-graph-atlas-3d.mp4"
links:
  - label: "Live atlas"
    href: "https://pratik-ingle.github.io/Academic-graph/"
  - label: "Code"
    href: "https://github.com/pratik-ingle/Academic-graph"
---

## Overview

Who works on what among the most-cited people in computer science and robotics? This project builds a knowledge graph of the top 1,000 researchers by citations, gives each one an embedding of their research, and lays them out as an interactive atlas: people who publish on similar subjects sit close together.

The data comes from [OpenAlex](https://openalex.org), an open index of researchers and papers with abstracts, topics, institutions and co-authorship. Google Scholar has no API and forbids scraping.

## How it works

- **Selection.** Authors are paged from OpenAlex by citations, from a computer-science pool and a robotics pool. Someone qualifies when at least half their topics are CS or robotics. Profiles that OpenAlex split are merged, and "ghost" profiles built from a single mega-paper are dropped.
- **Embedding.** SPECTER2 embeds the title and abstract of each researcher's 100 most-cited works. Their vector is the mean of those papers, weighted by log-citations.
- **Graph.** Each researcher links to their 10 most similar peers and to their co-authors. K-means clusters them into communities, grouped into 8 colour-coded research areas, and UMAP places them in 2D and 3D.
- **Storage and search.** Everything (researchers, papers, topics, institutions, communities) goes into Neo4j with vector indexes, so you can search by meaning ("legged locomotion with reinforcement learning") or find the researchers most like a given person.
- **The atlas.** A single HTML page with a flat map, a rotatable 3D view, co-author and similar-work links, search, a detail panel per researcher and a sortable table.

## Results

The atlas includes five findings computed from the graph, each with its method written up:

- **CS areas aren't converging.** Measured fairly, against neutral areas fitted on 2017–21 papers, research areas became 4–7% *more* distinct between the papers up to 2016 and those since 2022. Biased setups give anything from −31% to +63%; an earlier version of this analysis wrongly concluded that CS was converging on AI.
- **LLMs spread fast.** 65% of the 931 researchers active since 2022 have at least one LLM paper among their 30 most-cited recent papers. LLM papers went from 0.01% of all CS papers in 2020 to 6.9% in 2025.
- **Similar research predicts collaboration.** The most similar tenth of researcher pairs is 137× as likely to have co-authored as the least similar tenth, even with their shared papers removed from both profiles.
- **One-paper careers.** 187 of the 1,000 researchers get at least half their citations from a single paper.
- **Robotics is a small corner.** Only 44 of the 1,000 have robotics as a quarter or more of their topics, because CS citation counts are dominated by deep learning and vision.

A "Beyond CS" view asks the same AI questions of 12 other fields, from biology to the humanities.
