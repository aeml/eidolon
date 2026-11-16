import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';

const source = readFileSync('.github/workflows/ci.yml', 'utf8');
const steps = yaml.load(source).jobs['deploy-server'].steps;
const setup = steps.find(step => step.name === 'Configure SSH key');
const deploy = steps.find(step => step.name === 'Deploy via SSH');

test('deployment pins the reviewed public host identity instead of discovering trust at runtime', () => {
    const pin = setup.env.SSH_KNOWN_HOSTS;
    expect(pin).toMatch(/^ssh\.mendola\.tech ssh-ed25519 [A-Za-z0-9+/=]+$/);
    const blob = Buffer.from(pin.split(' ')[2], 'base64');
    const fingerprint = createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
    expect(fingerprint).toBe('4u6yOFA9tIp5zTHhMASbwsDVtWAKX7JyYidkJq6PDKE');
    expect(setup.run).toContain('printf \'%s\\n\' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts');
    expect(setup.run).toContain('chmod 600 ~/.ssh/known_hosts');
    expect(setup.run).not.toMatch(/ssh-keyscan|curl|wget|StrictHostKeyChecking=no/);
    expect(setup.env.SSH_PRIVATE_KEY).toBe('${{ secrets.SSH_PRIVATE_KEY }}');
});

test('the real deployment requires strict host verification and bounded connection/liveness waits', () => {
    const command = deploy.run.split('\n').find(line => /^\s*ssh\s/.test(line));
    expect(command).toContain('-o BatchMode=yes');
    expect(command).toContain('-o StrictHostKeyChecking=yes');
    expect(command).toContain('-o ConnectTimeout=10');
    expect(command).toContain('-o ConnectionAttempts=1');
    expect(command).toContain('-o ServerAliveInterval=15');
    expect(command).toContain('-o ServerAliveCountMax=2');
    expect(command).toContain('aeml@ssh.mendola.tech');
    expect(deploy.run).not.toMatch(/StrictHostKeyChecking=(no|accept-new)|UserKnownHostsFile=\/dev\/null/);
});
