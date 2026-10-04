// monitor emits JSON incident signals; it does not install itself or send mail.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"eidolon-server/internal/operations"
)

func run(ctx context.Context, args []string, output io.Writer) error {
	flags := flag.NewFlagSet("eidolon-monitor", flag.ContinueOnError)
	flags.SetOutput(io.Discard) // Invalid arguments can contain private values.
	endpoint := flags.String("health-url", "", "HTTPS /healthz or loopback HTTP")
	commit := flags.String("expected-commit", "", "optional exact release commit")
	timeout := flags.Duration("request-timeout", 0, "required, at most 10s")
	interval := flags.Duration("poll-interval", 0, "required, 1s to 5m")
	failures := flags.Int("failure-threshold", 0, "required consecutive failures, 1 to 60")
	recoveries := flags.Int("recovery-threshold", 0, "required consecutive successes, 1 to 60")
	cooldown := flags.Duration("notice-cooldown", 0, "required, 1m to 24h")
	if flags.Parse(args) != nil || flags.NArg() != 0 {
		return fmt.Errorf("invalid monitor arguments; see server/cmd/monitor/README.md")
	}
	probe, err := operations.NewProbe(*endpoint, *commit, *timeout)
	if err != nil {
		return err
	}
	detector, err := operations.NewDetector(*failures, *recoveries, *cooldown)
	if err != nil {
		return err
	}
	return operations.Monitor(ctx, probe, detector, *interval, output)
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
