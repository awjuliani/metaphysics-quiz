# What is Your Metaphysics?

Discover your philosophical worldview in 8 dimensions.

This interactive quiz maps your beliefs across fundamental metaphysical questions—from the nature of reality to the existence of the divine—and matches you with the historical system that best fits your views.

## Features

-   **8 Fundamental Dimensions**: Explore your stance on Ontology, Topology, Dynamics, Agency, Realism, Personality, and Relation.
-   **System Matching**: Compare your profile against 17 major philosophical systems, including Stoicism, Spinozism, Advaita Vedanta, Scientific Materialism, and more.
-   **Detailed Breakdown**: See exactly where you align and diverge with your top match and runner-up.
-   **Runner-Up Feature**: View your second-best match to see alternative perspectives that are close to your own.
-   **Responsive Design**: Works seamlessly on desktop and mobile devices.

## How to Run

Because this application loads data from JSON files, you need to run it through a local web server to avoid browser security restrictions (CORS).

### Using Python (Recommended)
If you have Python installed, you can run a simple server from the project directory:

```bash
# Python 3
python -m http.server

# Python 2
python -m SimpleHTTPServer
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

### Using Node.js
If you have Node.js installed, you can use `http-server`:

```bash
npx http-server .
```

Then open the URL shown in the terminal (usually [http://127.0.0.1:8080](http://127.0.0.1:8080)).

## Technologies Used

-   **HTML5**: Semantic structure.
-   **CSS3**: Custom styling with CSS variables for theming.
-   **Vanilla JavaScript (ES6+)**: Logic for the quiz, scoring, and UI updates.
-   **Google Fonts**: Typography (Outfit and Playfair Display).

## Credits

Developed by Arthur Juliani.
