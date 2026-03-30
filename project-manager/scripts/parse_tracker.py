#!/usr/bin/env python3
"""
Parse the CoupleFlow tracker.html and extract task data.

Usage:
  python parse_tracker.py <tracker_path> [--phase PHASE] [--status STATUS] [--next]

Examples:
  python parse_tracker.py tracker.html                          # Show all tasks
  python parse_tracker.py tracker.html --phase "Couple Features" # Filter by phase
  python parse_tracker.py tracker.html --status todo             # Filter by status
  python parse_tracker.py tracker.html --next                    # Show next task to work on
  python parse_tracker.py tracker.html --summary                 # Phase summary stats
"""

import re
import json
import sys
import argparse

def parse_tracker(filepath):
    """Extract the tasks array from tracker.html using regex per-object parsing."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the tasks array
    match = re.search(r'const tasks = \[(.*?)\];', content, re.DOTALL)
    if not match:
        print("ERROR: Could not find tasks array in tracker.html", file=sys.stderr)
        sys.exit(1)

    block = match.group(1)

    # Extract each {...} object
    tasks = []
    for obj_match in re.finditer(r'\{([^{}]+)\}', block):
        obj_str = obj_match.group(1)
        task = {}

        # Parse key:"value" and key:number patterns
        for field in re.finditer(r'(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"|(\w+)\s*:\s*(\d+)', obj_str):
            if field.group(1):  # string value
                task[field.group(1)] = field.group(2)
            elif field.group(3):  # numeric value
                task[field.group(3)] = int(field.group(4))

        if 'id' in task:
            tasks.append(task)

    if not tasks:
        print("ERROR: No tasks found in tracker.html", file=sys.stderr)
        sys.exit(1)

    return tasks

def get_next_task(tasks, phase=None):
    """Get the highest-priority incomplete task."""
    priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}

    candidates = [t for t in tasks if t.get('status') in ('todo', 'in-progress')]
    if phase:
        candidates = [t for t in candidates if t.get('phase') == phase]

    if not candidates:
        return None

    candidates.sort(key=lambda t: (priority_order.get(t.get('priority', ''), 99), t.get('id', 99)))
    return candidates[0]

def phase_summary(tasks):
    """Get completion stats per phase."""
    phases = {}
    for t in tasks:
        p = t.get('phase', 'Unknown')
        if p not in phases:
            phases[p] = {'total': 0, 'done': 0, 'in_progress': 0, 'todo': 0, 'blocked': 0}
        phases[p]['total'] += 1
        status_key = t.get('status', 'todo').replace('-', '_')
        if status_key in phases[p]:
            phases[p][status_key] += 1

    for p, s in phases.items():
        s['pct'] = round(s['done'] / s['total'] * 100) if s['total'] > 0 else 0

    return phases

def main():
    parser = argparse.ArgumentParser(description='Parse CoupleFlow tracker')
    parser.add_argument('tracker', help='Path to tracker.html')
    parser.add_argument('--phase', help='Filter by phase name')
    parser.add_argument('--status', help='Filter by status')
    parser.add_argument('--next', action='store_true', help='Show next task to work on')
    parser.add_argument('--summary', action='store_true', help='Show phase summary')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()

    tasks = parse_tracker(args.tracker)

    if args.summary:
        summary = phase_summary(tasks)
        if args.json:
            print(json.dumps(summary, indent=2))
        else:
            total_done = sum(s['done'] for s in summary.values())
            total = sum(s['total'] for s in summary.values())
            print(f"\n  CoupleFlow MVP Progress: {total_done}/{total} ({round(total_done/total*100)}%)\n")
            for phase, stats in summary.items():
                bar_len = 30
                filled = round(stats['pct'] / 100 * bar_len)
                bar = '█' * filled + '░' * (bar_len - filled)
                print(f"  {phase:<24} {bar} {stats['done']}/{stats['total']} ({stats['pct']}%)")
            print()
        return

    if args.next:
        task = get_next_task(tasks, args.phase)
        if task:
            if args.json:
                print(json.dumps(task, indent=2))
            else:
                print(f"\n  Next task: #{task['id']} — {task['title']}")
                print(f"  Phase: {task['phase']}")
                print(f"  Priority: {task['priority']}")
                print(f"  Area: {task['area']}")
                print(f"  Notes: {task.get('notes', '')}\n")
        else:
            print("  All tasks in this scope are complete!")
        return

    # Default: list tasks
    filtered = tasks
    if args.phase:
        filtered = [t for t in filtered if t.get('phase') == args.phase]
    if args.status:
        filtered = [t for t in filtered if t.get('status') == args.status]

    if args.json:
        print(json.dumps(filtered, indent=2))
    else:
        for t in filtered:
            status_icon = {'done': '✓', 'in-progress': '◐', 'todo': '○', 'blocked': '✗'}
            icon = status_icon.get(t.get('status', ''), '?')
            print(f"  {icon} #{t['id']:2d} [{t.get('priority', ''):<8}] {t['title']}")

if __name__ == '__main__':
    main()
