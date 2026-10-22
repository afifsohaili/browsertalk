<script lang="ts" setup>
import ConsentGate from '@/components/ConsentGate.vue';
import { useConsent } from '@/lib/consent/use-consent';
import PanelSurface from './PanelSurface.vue';

const {
  loaded: consentLoaded,
  status: consentStatus,
  accepted: consentAccepted,
  accept: acceptConsent,
  decline: declineConsent,
} = useConsent();
</script>

<template>
  <ConsentGate
    v-if="consentLoaded && !consentAccepted"
    :status="consentStatus"
    @accept="acceptConsent"
    @decline="declineConsent"
  />
  <PanelSurface v-else-if="consentLoaded" />
</template>
