import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';

const source = readFileSync('.github/workflows/ci.yml', 'utf8');
const steps = yaml.load(source).jobs['deploy-server'].steps;
const setup = steps.find(step => step.name === 'Configure SSH key');
const deploy = steps.find(step => step.name === 'Deploy via SSH');

test('deployment pins the exact reviewed public host identity, not a runtime network scan', () => {
    const pin = setup.env.SSH_KNOWN_HOSTS;
    expect(pin).toMatch(/^ssh\.mendola\.tech ssh-ed25519 [A-Za-z0-9+/=]+$/);
    const blob = Buffer.from(pin.split(' ')[2], 'base64');
    const fingerprint = createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
    expect(fingerprint).toBe('4u6yOFA9tIp5zTHhMASbwsDVtWAKX7JyYidkJq6PDKE');
    expect(setup.run).toContain('printf \'%s\\n\' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts');
    expect(setup.run).toContain('chmod 600 ~/.ssh/known_hosts');
    expect(setup.run).not.toMatch(/ssh-keyscan|curl|wget|StrictHostKeyChecking=no/);
});

test('the actual deploy command requires host validation before any remote release command', () => {
    expect(deploy.run).toContain('ssh -o BatchMode=yes -o StrictHostKeyChecking=yes aeml@ssh.mendola.tech');
    expect(deploy.run).not.toMatch(/StrictHostKeyChecking=(no|accept-new)|UserKnownHostsFile=\/dev\/null/);
    expect(deploy.run.indexOf('StrictHostKeyChecking=yes')).toBeLessThan(deploy.run.indexOf('COMMIT_SHA=\''));
    expect(setup.env.SSH_PRIVATE_KEY).toBe('${{ secrets.SSH_PRIVATE_KEY }}');
});
