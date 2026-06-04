import os
import sys
import lizard
from typing import Dict, Any, List

def get_complexity_level(ccn: int) -> str:
    """
    Categorizes the cyclomatic complexity into a human-readable scale.
    """
    if ccn <= 10:
        return "LOW"
    elif ccn <= 25:
        return "MEDIUM"
    else:
        return "HIGH"

def analyze_file_complexity(file_path: str) -> Dict[str, Any]:
    """
    Analyzes the Cyclomatic Complexity and lines of code (LOC) of a target source file
    using the Lizard library. Supports multiple languages including Python and JS/TS.
    
    Args:
        file_path: The absolute or relative path to the file to analyze.
        
    Returns:
        A dictionary containing total complexity, lines of code, level, and function-level breakdown.
    """
    fallback_result = {
        "complexity": 0,
        "cognitive_complexity": 0,  # Estimated as a fraction of CCN for dashboard compatibility
        "loc": 0,
        "level": "LOW",
        "functions": []
    }
    
    if not os.path.exists(file_path):
        return fallback_result
        
    try:
        # Check if file size is 0 or it's a binary file
        if os.path.getsize(file_path) == 0:
            return fallback_result
            
        # Analyze file using lizard
        analysis = lizard.analyze_file(file_path)
        
        # Calculate cognitive complexity estimate
        # Since Lizard measures Cyclomatic Complexity, we can approximate Cognitive Complexity.
        # Generally, functions with loops/conditionals have nesting, but since Lizard doesn't compute 
        # nesting depth directly, a standard fallback is 0.8 * CCN (or tracking it based on conditions).
        # We can also compute a simple estimation of cognitive complexity based on lizard's function list.
        functions_data = []
        total_ccn = analysis.CCN
        total_loc = analysis.nloc
        
        for f in analysis.function_list:
            # Estimate cognitive complexity per function: 
            # Often close to cyclomatic complexity but slightly different.
            # We can estimate it as f.cyclomatic_complexity - 1 (since base CCN is 1, and each decision is 1).
            # If there's nesting, cognitive is higher. But as a baseline, cyclomatic_complexity works well.
            cog_est = max(0, f.cyclomatic_complexity - 1)
            
            functions_data.append({
                "name": f.name,
                "start_line": f.start_line,
                "end_line": f.end_line,
                "complexity": f.cyclomatic_complexity,
                "cognitive_complexity": cog_est,
                "loc": f.nloc
            })
            
        total_cognitive = sum(fn["cognitive_complexity"] for fn in functions_data)
        
        return {
            "complexity": total_ccn,
            "cognitive_complexity": total_cognitive,
            "loc": total_loc,
            "level": get_complexity_level(total_ccn),
            "functions": functions_data
        }
        
    except Exception as e:
        print(f"Error analyzing complexity for {file_path}: {e}", file=sys.stderr)
        return fallback_result

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_file = sys.argv[1]
        print(f"Analyzing: {test_file}")
        import json
        print(json.dumps(analyze_file_complexity(test_file), indent=2))
    else:
        print("Please provide a file path to test.")
