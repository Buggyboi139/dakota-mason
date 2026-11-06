// Shared resume content for the site and the shelved redesigns. Pages render from this
// object, so a fact changes in one place. Load it with <script src="assets/js/content.js">.
(function () {
  // Site root, resolved from this script's own location (site/assets/js/content.js).
  const ROOT = new URL('../../', document.currentScript.src);
  const url = (p) => new URL(p, ROOT).href;

  window.SITE = {
    url,

    name: 'Dakota Mason',
    firstName: 'Dakota',
    lastName: 'Mason',
    headline: 'Cybersecurity Professional',
    tagline: 'Security, end to end.',
    location: 'Des Moines, Iowa',
    status: 'Searching for security roles · Des Moines, IA & remote',
    summary: "Navy veteran, former federal police officer, and security researcher with two CVEs. I find what's broken, document it clearly, and help get it fixed.",
    focusAreas: ['SOC analysis', 'vulnerability assessment', 'incident response', 'application security'],

    avatar: { src: url('assets/img/avatar.jpg'), w: 600, h: 600, alt: 'Dakota Mason in a navy suit' },
    portrait: { src: url('assets/img/headshot.jpg'), w: 1440, h: 1440, alt: 'Dakota Mason in a navy suit' },

    links: {
      resume: { label: 'Download resume', href: url('assets/Dakota-Mason-Resume.pdf'), download: true },
      linkedin: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/dakota-mason', handle: 'in/dakota-mason' },
      github: { label: 'GitHub', href: 'https://github.com/Buggyboi139', handle: 'Buggyboi139' },
      huggingface: { label: 'Hugging Face', href: 'https://huggingface.co/ByteOtter', handle: 'ByteOtter' },
      book: { label: 'My book', href: 'https://www.amazon.com/dp/B0F1W249XN' },
      email: { label: 'Email', href: 'mailto:dsmason321@gmail.com', address: 'dsmason321@gmail.com' },
    },

    stats: [
      { value: '2', unit: 'CVEs', label: 'from authorized bug bounty research' },
      { value: '8', unit: 'years', label: 'U.S. Navy & Navy Reserve' },
      { value: '$1.7B', unit: '', label: 'in critical assets protected' },
      { value: '2×', unit: 'NAM', label: 'Navy & Marine Corps Achievement Medals' },
    ],

    // Experience, newest first. start/end are YYYY-MM; end null means present.
    roles: [
      {
        id: 'research',
        short: 'Security Researcher / Student',
        title: 'Independent Security Researcher\u00a0/ Full\u2011Time Student',
        org: 'Self-employed',
        place: 'Des Moines, IA',
        coords: { lat: 41.59, lon: -93.62, label: '41.59°N 93.62°W' },
        start: '2024-06', end: '2026-10',
        dates: 'June 2024 – October 2026',
        years: '2024 – 2026',
        tags: ['Self-employed', 'Bugcrowd', 'HackerOne'],
        awards: ['2 CVEs assigned'],
        intro: 'After leaving the VA, I went all in on cybersecurity: full-time study for my B.S. alongside authorized bug bounty work on Bugcrowd and HackerOne. I test web applications inside each program\'s published scope, looking for the places where an application trusts the wrong person.',
        callout: { title: 'Two CVEs.', text: 'I found two broken-access-control (IDOR) vulnerabilities that were assigned CVEs. My write-ups documented reproduction steps and impact clearly enough for the vendors to fix them, and both findings paid bounties.' },
        groups: [
          {
            heading: 'What the work looks like',
            points: [
              'Reconnaissance, manual web application testing, and authorization-boundary testing within each program\'s scope.',
              'Investigating cross-site scripting (XSS) and server-side request forgery (SSRF) findings, with reports that describe impact and repeatable steps.',
              'Building Burp Cockpit, a Burp Suite extension that brings language-model analysis into web security testing.',
              'Running a Linux home lab: building and troubleshooting systems, and evaluating local AI models.',
              'Building TAK, a Rust model-quantization tool whose published models beat a leading quantizer at the same file size.',
            ],
          },
        ],
        note: null,
        tools: ['Burp Suite', 'Nmap', 'Nessus', 'Greenbone', 'AWS', 'Linux', 'Python', 'Git', 'Rust'],
        photo: { src: url('assets/img/headshot.jpg'), w: 1440, h: 1440, alt: 'Dakota Mason in a navy suit', caption: 'Former Navy Secret clearance · CompTIA Security+ and A+' },
      },
      {
        id: 'va',
        short: 'VA Police',
        title: 'Senior Police Officer, GS-0083-07',
        org: 'Department of Veterans Affairs',
        place: 'Des Moines, IA',
        coords: { lat: 41.59, lon: -93.62, label: '41.59°N 93.62°W' },
        start: '2022-09', end: '2024-06',
        dates: 'September 2022 – June 2024',
        years: '2022 – 2024',
        tags: ['Department of Veterans Affairs', 'Veterans Health Administration', 'Federal law enforcement'],
        awards: [],
        intro: 'As a federal police officer at the Des Moines VA medical center, I protected veterans, staff, and the sensitive information a hospital runs on. The job was part patrol, part investigator, and part access-control gatekeeper, and every part of it ran on careful documentation.',
        callout: null,
        groups: [
          {
            heading: 'Investigations',
            points: [
              'Led investigations from complaint review through fact-finding, interviews, evidence handling, and reports for legal or administrative review.',
              'Handled cases involving government laptops and more than $50,000 in government property.',
              'Investigated online abuse, harassment, and misuse of government property; interviewed subjects, victims, and witnesses and weighed conflicting accounts to reach supported findings.',
            ],
          },
          {
            heading: 'Protection and response',
            points: [
              'Enforced access controls and identity verification in restricted areas of the medical center.',
              'Safeguarded PII and PHI under VA privacy requirements.',
              'Responded to high-risk incidents, made arrests, and coordinated with federal, state, and local agencies.',
            ],
          },
        ],
        note: { heading: 'Why it matters for security', text: 'Incident response, chain of custody, insider-threat awareness, and writing findings that hold up to review: the same habits a SOC depends on.' },
        tools: [],
        photo: { src: url('assets/img/va-police.jpg'), w: 638, h: 953, alt: 'Dakota Mason in VA police uniform in front of the Department of Veterans Affairs seal and a U.S. flag', caption: 'Department of Veterans Affairs Police' },
      },
      {
        id: 'bahrain',
        short: 'Bahrain Deployment',
        title: 'Physical Security & Intelligence Specialist',
        org: 'U.S. Navy',
        place: 'Isa Air Base, Bahrain',
        coords: { lat: 25.92, lon: 50.59, label: '25.92°N 50.59°E' },
        start: '2019-12', end: '2021-04',
        dates: 'December 2019 – April 2021',
        years: '2019 – 2021',
        rank: 'MA2 (E-5)',
        tags: ['U.S. Navy', 'MA2 (E-5)', 'Deployment'],
        awards: ['Navy & Marine Corps Achievement Medal'],
        intro: 'In Bahrain I owned physical-security responsibility for an installation, and my threat analysis protected 1,487 personnel and $1.7 billion in critical assets. The work was risk management in the real world: find the gaps before someone else does, prioritize them, and brief leadership on what to fix first.',
        callout: null,
        groups: [
          {
            heading: 'Assessment and risk',
            points: [
              'Conducted vulnerability assessments, security audits, and risk analysis protecting 1,487 personnel and $1.7 billion in critical assets.',
              'Prepared intelligence and security briefings for senior installation leadership, turning incoming threat information into concise, actionable priorities.',
              'Handled classified information.',
            ],
          },
          {
            heading: 'Leading projects and people',
            points: [
              'Managed security infrastructure, lock, and key-control projects from planning through completion.',
              'Trained more than 150 personnel.',
              'Received a Navy and Marine Corps Achievement Medal.',
            ],
          },
        ],
        note: null,
        tools: [],
        photo: { src: url('assets/img/bahrain.jpg'), w: 1200, h: 1600, alt: 'Dakota Mason in uniform in Bahrain', caption: 'Isa Air Base, Bahrain, November 2020' },
      },
      {
        id: 'djibouti',
        short: 'Djibouti Deployment',
        title: 'Patrol Supervisor & Master-at-Arms',
        org: 'U.S. Navy',
        place: 'Camp Lemonnier, Djibouti',
        coords: { lat: 11.55, lon: 43.15, label: '11.55°N 43.15°E' },
        start: '2018-08', end: '2019-10',
        dates: 'August 2018 – October 2019',
        years: '2018 – 2019',
        rank: 'MA3 (E-4)',
        tags: ['U.S. Navy', 'MA3 (E-4)', 'Combat deployment'],
        awards: ['Navy & Marine Corps Achievement Medal'],
        intro: 'Camp Lemonnier is a forward-deployed joint installation in the Horn of Africa. I supervised the patrol and access-control operations that kept it secure, and led sailors in an environment where the threat was real.',
        callout: null,
        groups: [
          {
            heading: null,
            points: [
              'Supervised personnel in patrol and access-control operations at a forward-deployed joint installation.',
              'Served as incident commander during an emergency response.',
              'Received a Navy and Marine Corps Achievement Medal.',
            ],
          },
        ],
        note: null,
        tools: [],
        photo: { src: url('assets/img/djibouti.jpg'), w: 1600, h: 900, alt: 'Dakota Mason in uniform in the Djibouti desert with camels', caption: 'Djibouti, May 2019', wide: true },
      },
      {
        id: 'navy',
        short: 'Navy & Reserve',
        title: 'Master-at-Arms, U.S. Navy & Navy Reserve',
        org: 'U.S. Navy',
        place: 'Active duty and Navy Reserve, Des Moines',
        coords: null,
        start: '2015-09', end: '2023-09',
        dates: 'September 2015 – September 2023',
        years: '2015 – 2023',
        tags: ['Force protection', 'Former Secret clearance', 'Honorable service'],
        awards: [],
        intro: "Master-at-Arms is the Navy's security and law enforcement rating. Eight years in it, active and reserve, built the foundation everything else stands on: protect people and assets, control who gets in, and watch for threats from the inside as well as the outside.",
        callout: null,
        groups: [
          {
            heading: null,
            points: [
              'Force protection, access control, and physical security across multiple operational facilities.',
              'Insider-threat protocols and enforcement.',
              'Reserve service in Des Moines through September 2023.',
            ],
          },
        ],
        note: null,
        serviceTimeline: [
          { when: '2015', what: 'Enlisted as a Master-at-Arms' },
          { when: '2016 – 2017', what: 'Short-notice deployment, U.S. Naval Forces Korea, Busan · Flag Letter of Commendation' },
          { when: '2018 – 2019', what: 'Camp Lemonnier, Djibouti · MA3' },
          { when: '2019 – 2021', what: 'Isa Air Base, Bahrain · MA2' },
          { when: '2021 – 2023', what: 'Navy Reserve, Des Moines' },
        ],
        tools: [],
        photo: { src: url('assets/img/navy-blues.jpg'), w: 709, h: 945, alt: 'Dakota Mason in Navy dress blues beside a Navy officer in khakis', caption: 'In dress blues, February 2016' },
      },
    ],

    // Career milestones, oldest first, for timelines. Dates are YYYY-MM, or YYYY when the month isn't known.
    milestones: [
      { date: '2015-09', label: 'Enlisted in the U.S. Navy as a Master-at-Arms', ref: 'navy' },
      { date: '2016-12', label: 'Short-notice deployment to U.S. Naval Forces Korea, Busan', ref: 'navy' },
      { date: '2018-08', label: 'Deployed to Camp Lemonnier, Djibouti', ref: 'djibouti' },
      { date: '2019-12', label: 'Deployed to Isa Air Base, Bahrain', ref: 'bahrain' },
      { date: '2021', label: 'Navy Reserve, Des Moines', ref: 'navy' },
      { date: '2022-09', label: 'Senior Police Officer, Department of Veterans Affairs', ref: 'va' },
      { date: '2024-06', label: 'Full-time study and independent security research begin', ref: 'research' },
      { date: '2025-04', label: 'CompTIA Security+ and A+', ref: 'education' },
      { date: '2026-10', label: 'B.S. degree requirements completed; full-time study and security research end', ref: 'education' },
    ],

    tak: {
      id: 'tak',
      name: 'TAK',
      title: 'TAK: task-aware model quantization',
      subtitle: 'Task-aware model quantization',
      tag: 'Flagship · Rust · CUDA',
      stack: ['Rust', 'CUDA', 'Vulkan', 'llama.cpp', 'GGUF'],
      started: '2026-09',
      description: 'TAK shrinks large language models to a fixed file size while protecting the skill you care about. Instead of compressing every tensor the same way, it measures how each precision change affects a target task, solves for the best allocation under an exact byte budget, and exports a standard GGUF that runs anywhere llama.cpp does. No fine-tuning, no model merging: only smarter precision.',
      headline: {
        model: 'Qwen3.8-27B', task: 'reasoning',
        tak: 82.81, baseline: 77.34, baselineName: "Unsloth's UD-IQ2_S", delta: 5.47,
        gapToSource: 0.78, size: '8.37 GB', sourceSize: '54.7 GB', smaller: '85%',
        text: "TAK beat Unsloth's UD-IQ2_S by +5.47 points at the identical 8.37 GB file size, landing within 0.78 points of the 54.7 GB original: 85% smaller for nearly the same reasoning.",
      },
      benchmarks: [
        { model: 'Qwen3.8-27B', task: 'reasoning', value: '82.81 vs 77.34', delta: 5.47, text: "TAK beat Unsloth's UD-IQ2_S by +5.47 points at the identical 8.37 GB file size, landing within 0.78 points of the 54.7 GB original: 85% smaller for nearly the same reasoning." },
        { model: 'Gemma 4 E4B', task: 'reasoning', value: '+14.06', delta: 14.06, text: 'points over Unsloth UD-IQ2_M, with a 9% smaller file' },
        { model: 'Qwen3.5-4B', task: 'reasoning', value: '+11.72', delta: 11.72, text: 'points over Unsloth UD-IQ2_M at the same size' },
      ],
      points: [
        'Every score comes from the same frozen 960-item evaluation pack, run to completion with zero failed items. The headline is the run\'s target category; the other suites are diagnostics.',
        'Rust application built on a pinned llama.cpp runtime. Runs on Vulkan or CUDA, with resumable, checkpointed jobs and a headless GPU deployment for models too large for a workstation.',
        'Measures real tensor-format changes against the task\'s own grader, including executed-test grading for coding, and records signed effects of each change, alone and in pairs.',
        'Published winners on Hugging Face as the TAK Reasoning Champions collection.',
      ],
      links: [
        { label: 'TAK Reasoning Champions', href: 'https://huggingface.co/collections/ByteOtter/tak-reasoning-champions-6a9f09c206557492a82905f3' },
        { label: 'All models', href: 'https://huggingface.co/ByteOtter' },
      ],
      note: 'Source is private',
    },

    // Featured projects after TAK.
    featured: [
      {
        id: 'ironmargins',
        name: 'Iron Margins',
        tag: 'SaaS · PWA · Supabase',
        started: '2026-03',
        description: "Estimating, bidding, and invoicing software for contractors. It standardizes material costs, calculates true labor burden, including payroll taxes and workers' comp, and generates client-ready PDF proposals in minutes. Built as an offline-capable progressive web app.",
        detail: 'Designed with a written threat model covering client-side trust, authorization bypass, and service-worker hijacking, with server-side validation and a strict Content Security Policy as mitigations.',
        image: { src: url('assets/img/ironmargins.jpg'), w: 1400, h: 860, alt: 'Iron Margins home page' },
        links: [
          { label: 'ironmargins.com', href: 'https://ironmargins.com' },
          { label: 'GitHub', href: 'https://github.com/Buggyboi139/ironmargins' },
        ],
      },
      {
        id: 'pearltide',
        name: 'Pearl Tide',
        tag: 'Mobile game · Three.js · Capacitor',
        started: '2026-10',
        description: 'A cozy 3D mermaid game, live on the App Store for iPhone. Players swim a reef, a kelp forest, and crystal caverns, help the sea creatures they meet, and decorate a home in a sunken ship across a four-chapter story.',
        detail: 'Built in Three.js and wrapped for iOS and Android with Capacitor, with touch and desktop controls and adjustable graphics levels for phones.',
        image: { src: url('assets/img/pearltide.jpg'), w: 1024, h: 500, alt: 'Pearl Tide game art' },
        links: [
          { label: 'pearltide.world', href: 'https://pearltide.world/' },
        ],
      },
    ],

    // Smaller projects outside AI. The AI work lives in localAI below.
    more: [
      { id: 'burpcockpit', name: 'Burp Cockpit', tag: 'Security tooling', started: '2026-06', description: 'A Burp Suite extension that brings language-model analysis into web security testing.', links: [], note: 'Private repo' },
      { id: 'hostilevolume', name: 'Hostile Volume', tag: 'Game · PWA', started: '2026-03', description: 'A browser game with client-side state management and audio rendering.', links: [{ label: 'Play', href: 'https://hostilevolume.com' }, { label: 'GitHub', href: 'https://github.com/Buggyboi139/hostilevolume' }] },
    ],

    // Local AI: its own section. TAK (SITE.tak) is the flagship; these are the rest, in reading order.
    localAI: {
      id: 'ai',
      title: 'Local AI',
      kicker: 'Quantization, measurement, and interpretability on local models',
      intro: 'Most of my AI work runs on my own hardware, built around GGUF models and llama.cpp. It answers three questions: how small a model can get before it loses the skill you need, how to measure that honestly, and what is happening inside the model while it answers.',
      lineage: 'TAK grew out of QLAB, my earlier category-directed allocation lab, and keeps its task packs and grader. MLAB measures TAK\'s models independently, outside the optimization loop.',
      huggingface: { models: 4, label: '4 models published on Hugging Face as the TAK Reasoning Champions collection', href: 'https://huggingface.co/collections/ByteOtter/tak-reasoning-champions-6a9f09c206557492a82905f3' },
      takHow: [
        { step: 'Render', text: "Renders the task's prompts and references with the source model's own tokenizer and chat template." },
        { step: 'Collect', text: 'Collects activation statistics on those prompts for task-conditioned encoding.' },
        { step: 'Intervene', text: 'Changes real tensor formats, alone and in pairs, re-evaluates the model on the task, and records the signed effect of each change. A lower-precision change can help.' },
        { step: 'Solve', text: 'Solves a measured allocation problem with exact GGUF byte accounting, so the file lands under the size budget.' },
        { step: 'Confirm', text: 'Checks finalists on reserved development items through the deployment server, then exports an ordinary GGUF that needs no TAK component to run.' },
      ],
      takExtras: [
        'Explore mode maps a whole size range and reports the measured frontier, including the smallest file that keeps a target share of the source model\'s score.',
        'Coding runs grade generated programs by executing tests in a Bubblewrap sandbox.',
        'Bundled task packs: 4,096 items across eight selectable categories, plus a 512-task coding pack with a separate 256-item audit set.',
        'A headless CUDA deployment with systemd and persistent checkpoints runs models too large for a workstation.',
      ],
      projects: [
        {
          id: 'mlab',
          name: 'MLAB',
          tag: 'Rust · Measurement',
          started: '2026-08',
          description: 'A standalone measurement application for quantized GGUF models. TAK builds; MLAB measures independently, and reports every result as measured, not measured, or failed, with no pass/fail gate or verdict.',
          points: [
            'A frozen, hashed 960-item pack across 12 suites: coding, math, reasoning, knowledge, instruction following, summarization, structured output, general fidelity, coherence, stability, context, and runtime.',
            'Coding answers run as real Python tests inside a Bubblewrap sandbox; instruction following uses the official IFBench verifier.',
            'Package runs separate three effects: what the quantized model gains over stock llama.cpp, what calibration adds, and what tensor allocation adds on top.',
            'Paired hierarchical bootstrap intervals. An interval that crosses zero stays a measurement instead of becoming a verdict.',
            'Writes every result before moving on, so overnight runs pause, resume, and survive interruption.',
          ],
          links: [],
          note: 'Private repo',
        },
        {
          id: 'crystalskull',
          name: 'Crystal Skull',
          tag: 'Rust · egui · Activation grafting',
          started: '2026-07',
          description: 'A native Linux lab for activation grafting on local GGUF models. Type a phrase, and Crystal Skull builds a graft from the model\'s own activations, lets you chat with it grafted in, and benchmarks what it does to accuracy.',
          workflow: ['Graft', 'Chat', 'Benchmark'],
          points: [
            'Auto mode turns one phrase into 20 contrast pairs, traces the final-token residual stream across the middle 40–70% of layers, and averages the positive-minus-negative differences into a graft.',
            'Chat runs the grafted model beside an unsteered baseline on the same conversation, and records the exact model, graft revision, strength, and settings behind every answer.',
            'Benchmark measures a graft on GPQA Diamond, MMLU-Pro, AIME 2025, ARC-Challenge, and HellaSwag against a dry base-model pass, calling out regressions and recovered answers.',
            'Rust with egui and wgpu, driving a patched llama.cpp server it manages itself.',
          ],
          links: [],
          note: 'Private repo',
        },
        {
          id: 'glassskull',
          name: 'Glass Skull',
          tag: 'Python · Streamlit',
          started: '2026-06',
          description: 'A local Streamlit cockpit for running GGUF models through llama.cpp and visualizing model activity.',
          points: [
            'A patched llama.cpp server returns per-layer traces, which Glass Skull maps as an activation canvas.',
            'Direct activation steering on chosen nodes, such as L36-N175.',
            'The behavioral reference for Crystal Skull\'s graft extraction and steering.',
          ],
          links: [{ label: 'GitHub', href: 'https://github.com/Buggyboi139/glass-skull' }],
        },
        { id: 'smolllm', name: 'Smol-LLM', tag: 'Python', started: '2026-06', description: 'A tiny GPT-style language model built from scratch for testing tokenizers, data quality, and training behavior.', points: [], links: [{ label: 'GitHub', href: 'https://github.com/Buggyboi139/smol-llm' }] },
        { id: 'llamacalc', name: 'LlamaCalc', tag: 'JavaScript', started: '2026-06', description: 'A static command workbench that builds llama-cli and llama-server commands in the browser.', points: [], links: [{ label: 'Live site', href: 'https://llamabuilding.com/' }, { label: 'GitHub', href: 'https://github.com/Buggyboi139/llamacalc' }] },
      ],
    },

    // Awards. ribbons are in order of precedence; assets/js/ribbons.js draws them from this list.
    awards: {
      ribbons: [
        { id: 'nam', name: 'Navy and Marine Corps Achievement Medal', device: 'gold-star', note: 'gold star in lieu of the second award' },
        { id: 'ndsm', name: 'National Defense Service Medal' },
        { id: 'gwotem', name: 'Global War on Terrorism Expeditionary Medal', device: 'bronze-star', note: 'Djibouti and Bahrain; service star' },
        { id: 'gwotsm', name: 'Global War on Terrorism Service Medal' },
        { id: 'osr', name: 'Navy and Marine Corps Overseas Service Ribbon', device: 'bronze-star', note: 'second award' },
        { id: 'afrm', name: 'Armed Forces Reserve Medal', device: 'm', note: 'M device, mobilized' },
        { id: 'rifle', name: 'Navy Expert Rifleman Medal', device: 'e', note: 'expert, M4' },
        { id: 'pistol', name: 'Navy Expert Pistol Shot Medal', device: 'e', note: 'expert, M9' },
      ],
      citations: [
        {
          id: 'nam-djibouti',
          ref: 'djibouti',
          award: 'Navy and Marine Corps Achievement Medal',
          recipient: 'Master-at-Arms Third Class Dakota S. Mason, United States Navy',
          billet: 'Patrol Officer, Security Department, Camp Lemonnier, Djibouti',
          period: 'September 2018 – August 2019',
          given: '26 July 2019',
          signer: ['Kenneth C. Crowe', 'Captain, United States Navy', 'Commanding Officer, Camp Lemonnier'],
          text: "For professional achievement in the superior performance of his duties while serving as Patrol Officer, Security Department, Camp Lemonnier, Djibouti from September 2018 to August 2019 in support of Operation Enduring Freedom and Overseas Contingency Operations. A dedicated team player, Petty Officer Mason's initiative resulted in the completion of 2,160 hours of patrol and antiterrorism force protection operations. A true professional, he responded to 53 calls for service, completed 860 security checks, three incident complaint reports, and contributed to the overall safety and security of over 5,000 joint forces personnel and equipment onboard Camp Lemonnier. Petty Officer Mason's exceptional professionalism, unrelenting perseverance, and loyal devotion to duty reflected credit upon himself and were in keeping with the highest traditions of the United States Naval Service.",
        },
        {
          id: 'nam-bahrain',
          ref: 'bahrain',
          award: 'Navy and Marine Corps Achievement Medal',
          awardNote: 'Gold star in lieu of the second award',
          recipient: 'Master-at-Arms Third Class Dakota S. Mason, United States Navy',
          billet: 'Anti-Terrorism Intelligence Specialist, U.S. Naval Forces Central Command, Isa Air Base, Bahrain',
          period: 'February 2020 – January 2021',
          given: '8 March 2021',
          signer: ['A. F. Carlson', 'Captain, U.S. Navy', 'Chief of Staff, U.S. Naval Forces Central Command'],
          text: "For professional achievement in the superior performance of his duties while serving from February 2020 through January 2021. Displaying exceptional technical skills as Anti-Terrorism Intelligence Specialist, Petty Officer Mason analyzed 600 hours of terrorist data activity and provided detailed reports to the Mission Assurance Assessment Team, which led to the protection and security of 1,487 personnel and 1.7 billion dollars worth of critical assets. Committed to process improvements, he revamped the Random Anti-Terrorism Measure proposal, increasing the command's overall security posture. Additionally, he facilitated eight Right Start briefs, providing security guidance and cultural awareness while contributing to the seamless integration of 70 Sailors. Petty Officer Mason's exceptional professionalism, perseverance, and dedication to duty reflected credit on him and were in keeping with the highest traditions of the United States Naval Service.",
        },
        {
          id: 'floc',
          ref: 'navy',
          award: 'Flag Letter of Commendation',
          from: 'Commander, U.S. Naval Forces Korea',
          recipient: 'Master-at-Arms Seaman Apprentice Dakota Mason, United States Navy',
          billet: 'Staff of Commander, U.S. Naval Forces Korea, Busan',
          period: '20 December 2016 – 15 January 2017',
          given: null,
          signer: ['C. B. Cooper II', 'Rear Admiral, U.S. Navy', 'Commander, U.S. Naval Forces, Korea'],
          opening: 'Commander, U.S. Naval Forces Korea takes pleasure in commending Master-at-Arms Seaman Apprentice Dakota Mason, United States Navy, for service as set forth in the following citation:',
          text: "For superior performance of duty while serving on the staff of Commander, U.S. Naval Forces Korea (CNFK) from 20 December 2016 to 15 January 2017 and demonstrating outstanding professionalism and dedication to duty, Seaman Apprentice Mason volunteered to serve on a short notice deployment to the Korean peninsula during the holidays. He quickly integrated into the CNFK Staff and provided over 70 hours of critical watchstander support, effectively controlling access and ensuring the integrity of Naval Forces Korea Headquarters and Bunker spaces in Busan. His demonstrated leadership and reliability greatly enhanced the effectiveness and mission readiness of this Forward Deployed Naval Forces staff, and helped meet all operational and watchstander support requirements. Seaman Apprentice Mason's professionalism and devotion to duty reflected credit upon him and were in keeping with the highest traditions of the United States Naval Service.",
        },
      ],
    },

    // Every project in the order it started (repository creation month), oldest first.
    // Ties keep repository creation order.
    projectTimeline: ['hostilevolume', 'ironmargins', 'llamacalc', 'smolllm', 'glassskull', 'burpcockpit', 'crystalskull', 'mlab', 'tak', 'pearltide'],

    education: {
      degree: 'B.S., Cybersecurity Technology',
      school: 'University of Maryland Global Campus',
      details: ['120 credits', 'GPA 3.25'],
      status: 'All degree requirements completed in October 2026; conferral December 30, 2026.',
      certs: [
        { name: 'CompTIA Security+', date: 'April 2025' },
        { name: 'CompTIA A+', date: 'April 2025' },
      ],
      coursework: ['Ethical Hacking', 'Penetration Testing & Cyber Red Team', 'Threat Management & Vulnerability Assessment', 'Cloud Technologies', 'Red Hat Linux System Administration', 'Switching, Routing & Wireless'],
      skills: ['Vulnerability assessment', 'Web app testing', 'Access control testing', 'Incident response', 'Investigations', 'Risk analysis', 'PII/PHI safeguarding', 'TCP/IP', 'Linux', 'Windows', 'SIEM monitoring', 'SQL fundamentals'],
    },

    book: {
      title: 'Redemption of the Fallen God',
      subtitle: "A God's Fall, A Mortal's Fate",
      formats: ['Paperback', 'Kindle'],
      text: 'I wrote and self-published a fantasy novel, available in paperback and Kindle. Taking a book from draft through editing, cover, and publication on Amazon KDP took the same persistence as any long project: ship it, measure it, and keep improving it.',
      cover: { src: url('assets/img/book-cover.jpg'), w: 750, h: 1200, alt: 'Cover of Redemption of the Fallen God' },
      href: 'https://www.amazon.com/dp/B0F1W249XN',
      // Amazon star rating (the review count is left out on purpose).
      rating: { stars: 4.7, outOf: 5, label: '4.7 out of 5 stars on Amazon' },
      // Publication date as shown on Amazon.
      published: 'March 18, 2025',
    },

    footer: '© 2026 Dakota Mason · Des Moines, Iowa',
  };

  // Convenience lookups.
  const S = window.SITE;
  S.allProjects = [S.tak, ...S.featured, ...S.localAI.projects, ...S.more];
  S.citation = (id) => S.awards.citations.find((c) => c.id === id);
  S.citationsFor = (roleId) => S.awards.citations.filter((c) => c.ref === roleId);
  S.project = (id) => S.allProjects.find((p) => p.id === id);
  S.role = (id) => S.roles.find((r) => r.id === id);
})();
