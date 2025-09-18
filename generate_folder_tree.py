import os

def generate_directory_tree(root_dir, output_file):
    """
    Generates a text representation of a directory's structure.

    Args:
        root_dir (str): The absolute path of the root directory to scan.
        output_file (str): The path to the output text file.
    """
    if not os.path.isdir(root_dir):
        print(f"Error: Directory '{root_dir}' not found.")
        return

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"Directory tree for: {root_dir}\n\n")
        
        # The walk function generates the file and directory paths 
        # in a top-down manner.
        for dirpath, dirnames, filenames in os.walk(root_dir):
            # Calculate the level of depth for indentation
            level = dirpath.replace(root_dir, '').count(os.sep)
            indent = '│   ' * (level -1) + '├── ' if level > 0 else ''
            
            # Write the current directory name
            f.write(f"{indent}{os.path.basename(dirpath)}/\n")
            
            sub_indent = '│   ' * level + '├── '
            
            # Write the files in the current directory
            for i, filename in enumerate(filenames):
                # Use a different connector for the last file
                connector = '└── ' if i == len(filenames) - 1 else '├── '
                f.write(f"{'│   ' * level}{connector}{filename}\n")

    print(f"Directory structure has been saved to '{output_file}'")

if __name__ == '__main__':
    # --- Configuration ---
    # IMPORTANT: Set the path to the folder you want to analyze.
    # Example: '/Users/galahassa/Dev/voiceflow/voiceflow-pro'
    TARGET_DIRECTORY = '/Users/galahassa/Dev/voiceflow/voiceflowpro/manager' 
    
    # The name of the file where the output will be saved.
    OUTPUT_FILENAME = 'folder_structure.txt'
    
    # Get the absolute path to the output file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, OUTPUT_FILENAME)
    
    # --- Execution ---
    generate_directory_tree(TARGET_DIRECTORY, output_path)
