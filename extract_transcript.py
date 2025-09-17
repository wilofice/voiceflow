import re
import os
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


def extract_transcript_text(file_path):
    """
    Reads a transcript file, removes speaker and timestamp lines,
    and returns the cleaned text.

    Args:
        file_path (str): The path to the transcript file.

    Returns:
        str: The extracted and cleaned transcript text.
    """
    if not os.path.exists(file_path):
        return f"Error: File not found at {file_path}"

    # Give a moment for the file to be fully written
    time.sleep(0.1)
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Filter out lines with speaker/timestamp info (e.g., "Speaker 1 0:00:10 - 0:00:18")
    # and the initial file path comment.
    # This regex matches lines that start with "Speaker", followed by numbers and timestamps.
    # It also handles blank lines and the initial comment.
    text_lines = [
        line.strip() for line in lines 
        if not re.match(r'^Speaker\s+\d+\s+[\d:]{5,}\s+-\s+[\d:]{5,}\s*$', line.strip()) 
        and line.strip() != ''
        and not line.strip().startswith('//')
    ]
    
    return ' '.join(text_lines)


class TranscriptChangeHandler(FileSystemEventHandler):
    """Handles events on the transcript file."""
    def __init__(self, file_path, output_file_path):
        self.file_path = file_path
        self.filename = os.path.basename(file_path)
        self.output_file_path = output_file_path
        self._process() # Process the file on startup

    def on_modified(self, event):
        if not event.is_directory and os.path.basename(event.src_path) == self.filename:
            print(f"\n--- Detected modification in {self.filename}, reprocessing... ---")
            self._process()

    def _process(self):
        cleaned_text = extract_transcript_text(self.file_path)

        with open(self.output_file_path, 'w') as f:
            f.write(cleaned_text)
            
        print("--- Cleaned Transcript ---")
        print(cleaned_text)
        print("\nWatching for file changes... (Press Ctrl+C to stop)")


if __name__ == '__main__':
    transcript_file = 'transcript.txt'
    output_file = 'cleaned_transcript.txt'
    script_dir = os.path.dirname(os.path.abspath(__file__))

    output_path = os.path.join(script_dir, output_file)

    file_path = os.path.join(script_dir, transcript_file)

    if not os.path.exists(file_path):
        print(f"Error: Transcript file not found at {file_path}")
        exit()

    # Set up the watchdog observer
    event_handler = TranscriptChangeHandler(file_path, output_path)
    observer = Observer()
    # Watch the directory containing the file
    observer.schedule(event_handler, path=script_dir, recursive=False)
    
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n--- Observer stopped. ---")
    
    observer.join()
