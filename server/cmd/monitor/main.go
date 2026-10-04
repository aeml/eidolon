// monitor emits JSON incident signals with an explicitly opt-in alert adapter.
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
	postmarkAlerts := flags.Bool("postmark-alerts", false, "explicitly enable operator emails")
	mailTimeout := flags.Duration("mail-timeout", 0, "required with alerts, positive and at most10s")
	mailMinInterval := flags.Duration("mail-min-interval", 0, "required with alerts,1m to24h between all attempts")
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
	var notifier operations.Notifier
	if *postmarkAlerts {
		notifier, err = operations.NewPostmarkNotifier(operations.PostmarkConfig{Token: os.Getenv("POSTMARK_SERVER_TOKEN"),
			From: os.Getenv("POSTMARK_FROM_EMAIL"), Stream: os.Getenv("POSTMARK_MESSAGE_STREAM"),
			Recipients: os.Getenv("ADMIN_NOTIFICATION_EMAILS"), Timeout: *mailTimeout, MinInterval: *mailMinInterval})
		if err != nil {
			return err
		}
	} else if *mailTimeout != 0 || *mailMinInterval != 0 {
		return fmt.Errorf("mail settings require explicit postmark-alerts opt-in")
	}
	return operations.MonitorWithNotifier(ctx, probe, detector, *interval, output, notifier)
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
