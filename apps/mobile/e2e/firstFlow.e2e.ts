import { by, device, element, expect, waitFor } from 'detox';

/**
 * Happy-path E2E: launch → start recording → (stub audio streams) → stop &
 * generate → assert the specification document appears. Mirrors the manual QA
 * flow from the architecture document, section 6.
 */
describe('Voice2Spec — record to spec', () => {
  beforeAll(async () => {
    await device.launchApp({ permissions: { microphone: 'YES' } });
  });

  it('records and generates a specification', async () => {
    // Start recording.
    await element(by.id('record-button')).tap();
    await expect(element(by.id('waveform'))).toBeVisible();

    // Let the stub capture stream a few chunks into the live transcript.
    await waitFor(element(by.id('transcript')))
      .toBeVisible()
      .withTimeout(5000);

    // Stop & generate.
    await element(by.id('record-button')).tap();

    // The generated spec should appear.
    await waitFor(element(by.id('spec-document')))
      .toBeVisible()
      .withTimeout(30000);
  });
});
