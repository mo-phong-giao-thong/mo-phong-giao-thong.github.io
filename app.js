
let exams = [];
let situations = [];
let currentExamSituations = [];

const state = {
    mode: "exam",

    currentSituationId: null,
    currentExamId: null,
    answers: {},
    submitted: false,

    remainingSeconds: 15 * 60,
    timerId: null
};

const SCORE_PER_QUESTION = 0.25;
const PASS_SCORE = 7;


/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", async () => {

    document.body.classList.add("exam-mode");

    const backToTopButton = document.querySelector(".back-to-top");
    window.addEventListener("scroll", () => {
        backToTopButton.hidden = window.scrollY < 200;
    }, { passive: true });

    try {

        await loadData();

        if (exams.length > 0) {
            selectExam(exams[0].id);
        }

    } catch (error) {

        console.error(error);

        document.getElementById("situationTitle").textContent =
            "Không thể tải dữ liệu";

    }

});


/* =========================
   LOAD JSON
========================= */

async function loadData() {

    const response = await fetch(
        "./data/situations.json"
    );

    if (!response.ok) {
        throw new Error(
            "Không thể tải situations.json"
        );
    }

    const data = await response.json();

    exams = data.exams || [];
    situations = data.situations || [];

    if (situations.length === 0) {
        throw new Error(
            "Không có dữ liệu tình huống"
        );
    }

    if (exams.length === 0) {
        throw new Error("Không có dữ liệu đề thi");
    }
}


/* =========================
   EXAM LIST
========================= */

function renderExamList() {

    const container =
        document.getElementById("examList");

    container.innerHTML = exams.map(exam => `
            <button
                type="button"
                class="exam-btn ${exam.id === state.currentExamId ? "active" : ""}"
                onclick="selectExam(${exam.id})"
            >
                ${escapeHtml(exam.title)}
            </button>
        `).join("");
}


function selectExam(examId) {

    const exam = exams.find(item => item.id === examId);

    if (!exam) {
        return;
    }

    state.currentExamId = examId;
    state.answers = {};
    state.submitted = false;

    startExamTimer();

    currentExamSituations = exam.situations
        .map(id => situations.find(situation => situation.id === id))
        .filter(Boolean);

    if (currentExamSituations.length === 0) {
        return;
    }

    state.currentSituationId = currentExamSituations[0].id;

    document.getElementById(
        "examNumber"
    ).textContent =
        String(examId).padStart(2, "0");

    renderExamList();

    renderSituationList();

    renderSituation();

    updateOverallProgress();
}


/* =========================
   MODE
========================= */

function setMode(mode) {

    state.mode = mode;

    const examBtn =
        document.getElementById("examModeBtn");

    const studyBtn =
        document.getElementById("studyModeBtn");

    if (mode === "exam") {

        document.body.classList.remove(
            "study-mode"
        );

        document.body.classList.add(
            "exam-mode"
        );

        examBtn.classList.add("active");

        studyBtn.classList.remove("active");

    } else {

        document.body.classList.remove(
            "exam-mode"
        );

        document.body.classList.add(
            "study-mode"
        );

        studyBtn.classList.add("active");

        examBtn.classList.remove("active");
    }

    renderSituation();
}

/* =========================
   EXAM TIMER
========================= */

function startExamTimer() {
    clearInterval(state.timerId);

    state.remainingSeconds = 15 * 60;

    updateExamTimer();

    state.timerId = setInterval(() => {
        if (state.submitted) {
            clearInterval(state.timerId);
            return;
        }

        state.remainingSeconds--;

        updateExamTimer();

        if (state.remainingSeconds <= 0) {
            clearInterval(state.timerId);
            state.remainingSeconds = 0;

            // Hết giờ -> tự động nộp bài
            calculateResult();
        }
    }, 1000);
}


function updateExamTimer() {
    const timer = document.getElementById("examTimer");

    if (!timer) {
        return;
    }

    const minutes = Math.floor(state.remainingSeconds / 60);
    const seconds = state.remainingSeconds % 60;

    timer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    timer.classList.toggle(
        "warning",
        state.remainingSeconds <= 60
    );
}

/* =========================
   CURRENT SITUATION
========================= */

function getCurrentSituation() {

    return currentExamSituations.find(
        situation =>
            situation.id === state.currentSituationId
    );
}


function renderSituation() {

    const situation =
        getCurrentSituation();

    if (!situation) {
        return;
    }

    document.getElementById(
        "situationTitle"
    ).textContent = situation.title;

    const index =
        currentExamSituations.findIndex(
            item => item.id === situation.id
        );

    document.getElementById(
        "currentSituationNumber"
    ).textContent =
        String(index + 1).padStart(2, "0");

    document.getElementById("totalSituations").textContent =
        currentExamSituations.length;
    document.getElementById("totalSituationNumber").textContent =
        currentExamSituations.length;
    document.getElementById("sidebarTotal").textContent =
        currentExamSituations.length;

    const category = document.getElementById("situationCategory");
    if (category) {
        category.textContent = situation.categoryName || "Tình huống";
    }

    renderVideo(situation);

    renderQuestions(situation);

    renderSupport(situation);

    updateNavigation();

    renderSituationList();

    updateOverallProgress();
}


/* =========================
   VIDEO
========================= */

function renderVideo(situation) {

    const video =
        document.getElementById(
            "situationVideo"
        );

    const placeholder =
        document.getElementById(
            "videoPlaceholder"
        );

    if (situation.video) {

        video.src = situation.video;

        video.style.display = "block";

        placeholder.classList.add("hidden");

    } else {

        video.removeAttribute("src");

        video.load();

        video.style.display = "none";

        placeholder.classList.remove(
            "hidden"
        );
    }
}


/* =========================
   QUESTIONS
========================= */

function renderQuestions(situation) {

    const container =
        document.getElementById(
            "questions"
        );

    const answers =
        state.answers[situation.id] || {};

    let answered = 0;

    let html = state.submitted
        ? `
            <div class="answer-review-legend">
                <span class="review-correct">Đáp án đúng</span>
                <span class="review-incorrect">Đáp án sai đã chọn</span>
            </div>
        `
        : "";

    situation.questions.forEach(
        (question, questionIndex) => {

            const selected =
                answers[questionIndex];

            if (
                selected !== undefined &&
                selected !== null
            ) {
                answered++;
            }

            html += `
                <div class="question">

                    <div class="question-title">

                        <span class="question-number">
                            ${questionIndex + 1}
                        </span>

                        <span>
                            ${escapeHtml(question.title)}
                        </span>

                    </div>

                    <div class="options">

                        ${question.options.map(
                            (option, optionIndex) => {

                                const isSelected =
                                    selected === optionIndex;
                                const isCorrect =
                                    state.submitted && question.answer === optionIndex;
                                const isIncorrect =
                                    state.submitted && isSelected && !isCorrect;

                                return `
                                    <label
                                        class="option ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isIncorrect ? "incorrect" : ""}"
                                    >

                                        <input
                                            type="radio"
                                            name="question-${situation.id}-${questionIndex}"
                                            ${isSelected ? "checked" : ""}
                                            ${state.submitted ? "disabled" : ""}
                                            onchange="
                                                selectAnswer(
                                                    ${situation.id},
                                                    ${questionIndex},
                                                    ${optionIndex}
                                                )
                                            "
                                        >

                                        <span class="option-text">
                                            ${escapeHtml(option)}
                                        </span>

                                    </label>
                                `;
                            }
                        ).join("")}

                    </div>

                </div>
            `;
        }
    );

    container.innerHTML = html;

    document.getElementById(
        "questionProgress"
    ).textContent =
        `${answered}/${situation.questions.length}`;
}


/* =========================
   ANSWER
========================= */

function selectAnswer(
    situationId,
    questionIndex,
    optionIndex
) {

    if (state.submitted) {
        return;
    }

    if (!state.answers[situationId]) {
        state.answers[situationId] = {};
    }

    state.answers[situationId][questionIndex] =
        optionIndex;

    renderQuestions(
        getCurrentSituation()
    );

    renderSituationList();

    updateOverallProgress();
}


/* =========================
   SITUATION STATUS
========================= */

function getSituationStatus(
    situationId
) {

    const situation =
        currentExamSituations.find(
            item => item.id === situationId
        );

    if (!situation) {
        return "unanswered";
    }


    /*
     * QUAN TRỌNG:
     *
     * Nếu đang đứng ở tình huống này
     * thì luôn hiển thị "Đang làm".
     *
     * Kể cả khi đã trả lời đủ 4 câu.
     */

    if (
        situationId ===
        state.currentSituationId
    ) {
        return "current";
    }


    if (isSituationAnswered(situation)) {
        return "answered";
    }


    return "unanswered";
}


/* =========================
   SITUATION LIST
========================= */

function renderSituationList() {

    const container =
        document.getElementById(
            "situationList"
        );

    if (!currentExamSituations.length) {
        return;
    }

    let html = "";

    currentExamSituations.forEach(
        (situation, index) => {

            const status =
                getSituationStatus(
                    situation.id
                );

            html += `
                <button
                    type="button"
                    class="
                        situation-item
                        situation-${status}
                    "
                    aria-label="Tình huống ${index + 1}: ${escapeHtml(situation.title)}. ${getStatusText(status)}"
                    onclick="
                        goToSituation(
                            ${situation.id}
                        )
                    "
                >

                    <span
                        class="situation-number-box"
                    >
                        ${String(index + 1).padStart(2, "0")}
                    </span>

                    <span
                        class="situation-title"
                    >
                        ${escapeHtml(situation.title)}
                    </span>

                    <span
                        class="situation-status"
                    >
                        ${getStatusText(status)}
                    </span>

                </button>
            `;
        }
    );

    container.innerHTML = html;
}


function getStatusText(status) {

    switch (status) {

        case "current":
            return "Đang làm";

        case "answered":
            return "Đã trả lời";

        default:
            return "Chưa trả lời";
    }
}


/* =========================
   GO TO SITUATION
========================= */

function goToSituation(
    situationId
) {

    const exists =
        currentExamSituations.some(
            situation =>
                situation.id === situationId
        );

    if (!exists) {
        return;
    }

    state.currentSituationId =
        situationId;

    renderSituation();
}


/* =========================
   NAVIGATION
========================= */

function previousSituation() {

    const currentIndex =
        currentExamSituations.findIndex(
            situation =>
                situation.id ===
                state.currentSituationId
        );

    if (currentIndex <= 0) {
        return;
    }

    state.currentSituationId =
        currentExamSituations[currentIndex - 1].id;

    renderSituation();
}


function nextSituation() {

    const currentIndex =
        currentExamSituations.findIndex(
            situation =>
                situation.id ===
                state.currentSituationId
        );

    if (
        currentIndex < 0 ||
        currentIndex >= currentExamSituations.length - 1
    ) {
        return;
    }

    state.currentSituationId =
        currentExamSituations[currentIndex + 1].id;

    renderSituation();
}


function updateNavigation() {

    const currentIndex =
        currentExamSituations.findIndex(
            situation =>
                situation.id ===
                state.currentSituationId
        );

    document.getElementById(
        "prevBtn"
    ).disabled =
        currentIndex <= 0;

    document.getElementById(
        "nextBtn"
    ).disabled =
        currentIndex >= currentExamSituations.length - 1;
}


/* =========================
   SUPPORT
========================= */

function renderSupport(situation) {

    const support =
        situation.support || {};

    document.getElementById(
        "supportIndirect"
    ).textContent =
        support.indirect || "";

    document.getElementById(
        "supportDirect"
    ).textContent =
        support.direct || "";

    document.getElementById(
        "supportHandling"
    ).textContent =
        support.handling || "";
}


/* =========================
   PROGRESS
========================= */

function isSituationAnswered(
    situation
) {

    const answers =
        state.answers[situation.id] || {};

    return situation.questions.every(
        (_, questionIndex) => answers[questionIndex] !== undefined
    );
}


function updateOverallProgress() {

    let completed = 0;

    currentExamSituations.forEach(
        situation => {

            if (
                isSituationAnswered(
                    situation
                )
            ) {
                completed++;
            }
        }
    );

    document.getElementById(
        "answeredCount"
    ).textContent = completed;

    document.getElementById(
        "sidebarAnswered"
    ).textContent = completed;
}


function submitExam() {

    const totalQuestions =
        currentExamSituations.reduce(
            (total, situation) =>
                total + situation.questions.length,
            0
        );

    const answeredQuestions =
        currentExamSituations.reduce(
            (total, situation) => {

                const answers =
                    state.answers[situation.id] || {};

                return total + situation.questions.filter(
                    (_, questionIndex) => answers[questionIndex] !== undefined
                ).length;

            },
            0
        );

    const unanswered =
        totalQuestions - answeredQuestions;

    showSubmitConfirm(unanswered);
}


/* =========================
   SUBMIT CONFIRM MODAL
========================= */

function showSubmitConfirm(unanswered) {

    const modal =
        document.getElementById("submitModal");

    const message =
        document.getElementById("submitMessage");

    const unansweredText =
        document.getElementById("submitUnanswered");

    if (unanswered > 0) {

        message.textContent =
            "Bạn chưa hoàn thành toàn bộ bài thi.";

        unansweredText.innerHTML = `
            Còn <strong>${unanswered}</strong>
            câu chưa trả lời.
        `;

    } else {

        message.textContent =
            "Bạn đã hoàn thành toàn bộ bài thi.";

        unansweredText.textContent =
            "Bạn có chắc chắn muốn nộp bài?";
    }

    modal.classList.remove("hidden");
}


function closeSubmitModal() {

    document.getElementById(
        "submitModal"
    ).classList.add("hidden");
}


function confirmSubmit() {

    closeSubmitModal();

    calculateResult();
}


/* =========================
   CALCULATE RESULT
========================= */

function calculateResult() {

    if (state.submitted) {
        return;
    }

    clearInterval(state.timerId);

    state.submitted = true;
    
    renderSituation();

    const totalQuestions =
        currentExamSituations.reduce(
            (total, situation) =>
                total + situation.questions.length,
            0
        );

    let correct = 0;

    currentExamSituations.forEach(
        situation => {

            const answers =
                state.answers[situation.id] || {};

            situation.questions.forEach(
                (question, questionIndex) => {

                    if (
                        answers[questionIndex] !==
                        undefined &&
                        answers[questionIndex] ===
                        question.answer
                    ) {
                        correct++;
                    }

                }
            );
        }
    );

    const score =
        correct * SCORE_PER_QUESTION;

    showResult(
        score,
        correct,
        totalQuestions
    );
}


/* =========================
   RESULT
========================= */

function showResult(
    score,
    correct,
    totalQuestions
) {

    const completedSituations =
        currentExamSituations.filter(
            isSituationAnswered
        ).length;

    document.getElementById(
        "resultScore"
    ).textContent =
        score.toFixed(2);

    document.getElementById(
        "resultCorrect"
    ).textContent =
        correct;

    document.getElementById(
        "resultTotal"
    ).textContent =
        totalQuestions;

    document.getElementById(
        "resultSituations"
    ).textContent =
        completedSituations;


    const status =
        document.getElementById(
            "resultStatus"
        );

    if (score >= PASS_SCORE) {

        status.textContent =
            "ĐẠT";

        status.style.color =
            "#16a34a";

    } else {

        status.textContent =
            "CHƯA ĐẠT";

        status.style.color =
            "#dc2626";
    }


    document.getElementById(
        "resultModal"
    ).classList.remove("hidden");
}


function closeResult() {

    document.getElementById(
        "resultModal"
    ).classList.add("hidden");
}


function retakeExam() {
    const examId = state.currentExamId;

    closeResult();
    selectExam(examId);
    window.scrollTo({ top: 0, behavior: "smooth" });
}


function escapeHtml(value) {
    if (value == null) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
