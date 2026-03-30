#!/usr/bin/env python3
"""
Update a task's status in tracker.html.

Usage:
  python update_tracker.py <tracker_path> <task_id> <new_status> [--notes "additional notes"]

Examples:
  python update_tracker.py tracker.html 42 done --notes "Built partner dashboard with combined view"
  python update_tracker.py tracker.html 43 in-progress
  python update_tracker.py tracker.html 44 blocked --notes "Needs websocket support first"
"""

import re
import sys
import argparse

def update_task(filepath, task_id, new_status, notes=None):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the specific task by id and update its status
    # Pattern: {id:42, ... status:"todo", ... notes:"..."}
    task_pattern = re.compile(
        r'(\{id:' + str(task_id) + r',.*?status:")(\w[\w-]*)(".*?notes:")([^"]*?)(".*?\})',
        re.DOTALL
    )

    match = task_pattern.search(content)
    if not match:
        print(f"ERROR: Task #{task_id} not found in tracker", file=sys.stderr)
        sys.exit(1)

    old_status = match.group(2)
    old_notes = match.group(4)
    new_notes = f"{old_notes} | Updated: {notes}" if notes else old_notes

    replacement = f"{match.group(1)}{new_status}{match.group(3)}{new_notes}{match.group(5)}"
    content = content[:match.start()] + replacement + content[match.end():]

    with open(filepath, 'w') as f:
        f.write(content)

    print(f"  ✓ Task #{task_id}: {old_status} → {new_status}")
    if notes:
        print(f"    Notes: {notes}")

def main():
    parser = argparse.ArgumentParser(description='Update tracker task status')
    parser.add_argument('tracker', help='Path to tracker.html')
    parser.add_argument('task_id', type=int, help='Task ID to update')
    parser.add_argument('status', choices=['todo', 'in-progress', 'done', 'blocked'],
                       help='New status')
    parser.add_argument('--notes', help='Additional notes to append')
    args = parser.parse_args()

    update_task(args.tracker, args.task_id, args.status, args.notes)

if __name__ == '__main__':
    main()
