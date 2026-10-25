<script setup lang="ts">
import type { Component } from 'vue'
import { IonContent, IonPage } from '@ionic/vue'
import {
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  ClipboardList,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
} from '@lucide/vue'
import AppLink from '@/components/AppLink.vue'
import AppLogo from '@/components/AppLogo.vue'
import DisclosureSection from '@/components/DisclosureSection.vue'
import ServiceIcon from '@/components/ServiceIcon.vue'
import { SERVICES } from '@/domain/services'

interface Step {
  readonly title: string
  readonly text: string
  readonly icon: Component
}

const STEPS: readonly Step[] = [
  {
    title: 'Describe the problem',
    text: 'Tell the shop what is broken, add photos, and choose a service category.',
    icon: ClipboardList,
  },
  {
    title: 'Review the quotation',
    text: 'The shop sends a clear itemized quotation. Approve only what you accept.',
    icon: ReceiptText,
  },
  {
    title: 'Pick a time',
    text: 'Choose an open slot from the shop schedule. Changes notify both sides.',
    icon: CalendarCheck,
  },
  {
    title: 'Track to completion',
    text: 'Follow progress from drop off to pickup, then rate the service.',
    icon: CircleCheck,
  },
]

/** Smooth scroll inside Ionic content, where native anchor jumps do not apply. */
function scrollToSection(id: string): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <ion-page>
    <ion-content>
      <header class="landing__bar">
        <div class="landing__shell landing__bar-inner">
          <AppLogo />
          <nav class="landing__nav" aria-label="Landing page navigation">
            <a href="#how" @click.prevent="scrollToSection('how')">How it works</a>
            <a href="#services" @click.prevent="scrollToSection('services')">Services</a>
            <AppLink to="/diagnose">Quick check</AppLink>
            <a href="#faq" @click.prevent="scrollToSection('faq')">FAQ</a>
          </nav>
          <div class="landing__actions">
            <AppLink to="/auth" class="ff-btn ff-btn--primary">
              Get started
              <ArrowRight class="ff-icon ff-icon--sm" aria-hidden="true" />
            </AppLink>
          </div>
        </div>
      </header>

      <main id="main-content" class="landing__shell" tabindex="-1">
        <section class="landing__hero" aria-labelledby="landing-title">
          <p class="ff-badge ff-badge--brand">Local repair bookings in one place</p>
          <h1 id="landing-title" class="landing__title">Repairs, quoted and booked in one place</h1>
          <p class="ff-lead">
            Send a request, review the quotation, pick a time, and follow the repair to completion.
            FixFlow keeps customers and local shops aligned at every step.
          </p>
          <div class="landing__hero-cta">
            <AppLink to="/auth" class="ff-btn ff-btn--primary">
              Get started
              <ArrowRight class="ff-icon ff-icon--sm" aria-hidden="true" />
            </AppLink>
            <AppLink to="/diagnose" class="ff-btn ff-btn--secondary">
              Run a quick check
              <Stethoscope class="ff-icon ff-icon--sm" aria-hidden="true" />
            </AppLink>
          </div>
        </section>

        <section id="how" class="landing__section" aria-labelledby="how-title" tabindex="-1">
          <div class="landing__heading">
            <p class="ff-overline">Process</p>
            <h2 id="how-title" class="ff-h2">How FixFlow works</h2>
            <p class="ff-meta">Four steps from broken to fixed. Every step notifies the right person.</p>
          </div>
          <ol class="landing__grid">
            <li v-for="(step, index) in STEPS" :key="step.title" class="ff-card landing__step">
              <div class="landing__step-top">
                <span class="landing__step-num" aria-hidden="true">{{ index + 1 }}</span>
                <component :is="step.icon" class="ff-icon ff-icon--lg landing__step-icon" aria-hidden="true" />
              </div>
              <h3 class="ff-h3">{{ step.title }}</h3>
              <p class="ff-meta">{{ step.text }}</p>
            </li>
          </ol>
        </section>

        <section id="services" class="landing__section" aria-labelledby="services-title" tabindex="-1">
          <div class="landing__heading">
            <p class="ff-overline">Coverage</p>
            <h2 id="services-title" class="ff-h2">Services covered</h2>
            <p class="ff-meta">Choose a category to start. The shop confirms the scope in the quotation.</p>
          </div>
          <ul class="landing__grid">
            <li v-for="service in SERVICES" :key="service.id" class="ff-card landing__service">
              <ServiceIcon :service-id="service.id" />
              <h3 class="ff-h3">{{ service.name }}</h3>
              <p class="ff-meta">{{ service.blurb }}</p>
            </li>
          </ul>
          <aside class="ff-card landing__callout" aria-labelledby="quick-check-title">
            <span class="landing__callout-icon" aria-hidden="true">
              <Stethoscope class="ff-icon ff-icon--lg" aria-hidden="true" />
            </span>
            <div class="landing__callout-body">
              <h3 id="quick-check-title" class="ff-h3">Not sure which service you need?</h3>
              <p class="ff-meta">
                Answer three quick questions to see a likely cause, a safe next step, and a request
                you can send to the shop.
              </p>
              <AppLink to="/diagnose" class="ff-btn ff-btn--secondary">
                Run a quick check
                <ArrowRight class="ff-icon ff-icon--sm" aria-hidden="true" />
              </AppLink>
            </div>
          </aside>
        </section>

        <section class="landing__section" aria-labelledby="roles-title">
          <div class="landing__heading">
            <p class="ff-overline">Roles</p>
            <h2 id="roles-title" class="ff-h2">Built for both sides</h2>
          </div>
          <div class="landing__grid">
            <article class="ff-card landing__role">
              <h3 class="ff-h3">For customers</h3>
              <ul class="landing__list">
                <li>Send structured requests in minutes</li>
                <li>Approve clear itemized quotations</li>
                <li>Book open slots without phone calls</li>
                <li>Track status and rate the work</li>
              </ul>
            </article>
            <article class="ff-card landing__role">
              <h3 class="ff-h3">For shop owners</h3>
              <ul class="landing__list">
                <li>Receive complete requests with photos</li>
                <li>Send quotations in one itemized form</li>
                <li>Publish availability and cut no shows</li>
                <li>Keep every job status visible</li>
              </ul>
            </article>
          </div>
        </section>

        <section class="ff-inset landing__callout" aria-labelledby="trust-title">
          <span class="landing__callout-icon" aria-hidden="true">
            <ShieldCheck class="ff-icon ff-icon--lg" aria-hidden="true" />
          </span>
          <div class="landing__callout-body">
            <h2 id="trust-title" class="ff-h3">Private by design for this preview</h2>
            <p class="ff-meta">
              Sample data is stored on this device only. Try a demo account to see both sides of the
              workflow before you create your own account.
            </p>
          </div>
        </section>

        <section id="faq" class="landing__section" aria-labelledby="faq-title" tabindex="-1">
          <div class="landing__heading">
            <p class="ff-overline">Answers</p>
            <h2 id="faq-title" class="ff-h2">Frequently asked questions</h2>
          </div>
          <div class="landing__faq">
            <DisclosureSection title="Is FixFlow free to try?">
              <p class="ff-meta">
                Yes. Browse services, create a request, and try the demo accounts without payment.
                Shops set their own repair prices inside each quotation.
              </p>
            </DisclosureSection>
            <DisclosureSection title="Do I pay before the shop confirms?">
              <p class="ff-meta">
                No. You review an itemized quotation first and approve only the lines you accept.
                Booking happens after approval.
              </p>
            </DisclosureSection>
            <DisclosureSection title="What happens when my schedule changes?">
              <p class="ff-meta">
                Open the request detail page and choose a new open slot. Both sides receive an update
                so nobody arrives at the wrong time.
              </p>
            </DisclosureSection>
            <DisclosureSection title="I own a repair shop. What do I receive?">
              <p class="ff-meta">
                A dashboard for incoming requests, an itemized quotation builder, an availability
                editor, and status tracking from intake to pickup.
              </p>
            </DisclosureSection>
          </div>
        </section>

        <section class="ff-card landing__final" aria-labelledby="final-title">
          <h2 id="final-title" class="ff-h2">Ready when something breaks</h2>
          <p class="ff-meta">Create an account, send your first request, and get a clear quotation.</p>
          <div class="landing__hero-cta">
            <AppLink to="/auth" class="ff-btn ff-btn--primary">
              Get started
              <ArrowRight class="ff-icon ff-icon--sm" aria-hidden="true" />
            </AppLink>
          </div>
        </section>
      </main>

      <footer class="landing__footer">
        <div class="landing__shell landing__footer-inner">
          <AppLogo />
          <p class="ff-meta">Request it. Quote it. Book it. Track it.</p>
        </div>
      </footer>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.landing__shell {
  width: 100%;
  max-width: var(--content-max);
  margin-inline: auto;
  padding-inline: var(--page-pad);
}

.landing__bar {
  position: sticky;
  top: 0;
  z-index: 10;
  padding-top: var(--safe-top);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.landing__bar-inner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-height);
  padding-block: var(--space-2);
}

.landing__nav {
  display: none;
  align-items: center;
  gap: var(--space-4);
  margin-inline-start: var(--space-4);
}

.landing__nav a {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-decoration: none;
}

.landing__nav a:hover {
  color: var(--color-brand-dark);
}

.landing__actions {
  display: flex;
  align-items: center;
  margin-inline-start: auto;
}

.landing__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  padding-block: var(--space-10);
}

.landing__title {
  font-size: var(--text-2xl);
  font-weight: var(--weight-extrabold);
  line-height: var(--leading-tight);
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.landing__hero-cta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.landing__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-8);
  scroll-margin-top: calc(var(--control-height) + var(--space-4));
}

.landing__heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.landing__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

.landing__step {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.landing__step-top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.landing__step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  background: var(--color-brand-light);
  border: 1px solid var(--color-brand-border);
  border-radius: var(--radius-full);
  color: var(--color-brand-dark);
  font-size: var(--text-sm);
  font-weight: var(--weight-extrabold);
}

.landing__step-icon {
  color: var(--color-brand);
}

.landing__service {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
}

.landing__role {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.landing__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: disc;
  padding-inline-start: var(--space-5);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.landing__callout {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.landing__callout-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--avatar-size);
  height: var(--avatar-size);
  background: var(--color-brand-light);
  border: 1px solid var(--color-brand-border);
  border-radius: var(--radius-sm);
  color: var(--color-brand-dark);
}

.landing__callout-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.landing__faq {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.landing__final {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  margin-block: var(--space-8);
  text-align: left;
}

.landing__footer {
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.landing__footer-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding-block: var(--space-6);
}

@media (min-width: 48rem) {
  .landing__bar-inner {
    gap: var(--space-4);
  }

  .landing__nav {
    display: flex;
  }

  .landing__title {
    font-size: var(--text-3xl);
  }

  .landing__hero-cta {
    flex-direction: row;
    flex-wrap: wrap;
    width: auto;
  }

  .landing__grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .landing__footer-inner {
    flex-direction: row;
    align-items: center;
  }
}
</style>
